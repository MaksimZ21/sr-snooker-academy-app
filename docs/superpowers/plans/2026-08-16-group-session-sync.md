# Group → Future Sessions Membership Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student is added to or removed from a group, automatically apply that same change to every future (not-yet-happened, not-cancelled) session tied to that group — without touching sessions that already happened or students manually added to a session outside the group.

**Architecture:** A single new helper, `syncGroupMembershipToSessions(groupId, added, removed)`, lives in `src/lib/sheets/groups.ts` next to the group-mutation functions that need to trigger it. It's called from the two existing places group membership actually changes: `updateGroup()` (admin edits a group's roster) and `ensureStudentInCollegeGroup()` (CRM/college auto-add, single student). No new tables, no new API routes, no UI changes.

**Tech Stack:** TypeScript, Supabase (`db` client from `@/lib/db/client`), Next.js `unstable_cache`/`revalidateTag` (existing `invalidateSessions()` from `src/lib/sheets/sessions.ts`).

**Spec:** `docs/superpowers/specs/2026-08-16-group-session-sync-design.md`

**Testing note:** This codebase does not unit-test Supabase-backed modules in `src/lib/sheets/` (only pure-logic files like `resolveRole.ts`/`date.ts`/`schemas.ts` have vitest coverage — there's no mocking setup for the `db` client). Consistent with how prior backend-only changes in this project were verified, this plan uses `npx tsc --noEmit` as the automated gate for each step, plus a manual end-to-end verification task at the end using the real admin UI against the dev database.

---

### Task 1: Add `syncGroupMembershipToSessions` helper

**Files:**
- Modify: `src/lib/sheets/groups.ts`

- [ ] **Step 1: Add the `invalidateSessions` import**

At the top of `src/lib/sheets/groups.ts`, change:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Group } from "./schemas";
```

to:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { invalidateSessions } from "./sessions";
import type { Group } from "./schemas";
```

- [ ] **Step 2: Add the sync function**

Add this new function at the end of `src/lib/sheets/groups.ts` (after `ensureStudentInCollegeGroup`):

```ts
export async function syncGroupMembershipToSessions(
  groupId: string,
  added: string[],
  removed: string[],
): Promise<void> {
  if (added.length === 0 && removed.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("sessions")
    .select("id, student_ids")
    .eq("group_id", groupId)
    .gte("date", today)
    .neq("status", "cancelled");

  const sessions = (data ?? []) as { id: string; student_ids: unknown }[];

  for (const session of sessions) {
    const current: string[] = Array.isArray(session.student_ids)
      ? (session.student_ids as string[])
      : [];
    const next = new Set(current);
    let changed = false;

    for (const id of added) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    for (const id of removed) {
      if (next.delete(id)) {
        changed = true;
      }
    }

    if (changed) {
      await db
        .from("sessions")
        .update({ student_ids: Array.from(next) })
        .eq("id", session.id);
    }
  }

  invalidateSessions();
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the function is unused so far — that's fine, TypeScript doesn't error on unused exports).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/groups.ts
git commit -m "feat(groups): add syncGroupMembershipToSessions helper"
```

---

### Task 2: Wire `updateGroup` to diff membership and call the sync

**Files:**
- Modify: `src/lib/sheets/groups.ts:47-63` (the existing `updateGroup` function)

- [ ] **Step 1: Replace `updateGroup` with a diffing version**

Change:

```ts
export async function updateGroup(
  id: string,
  name: string,
  studentIds: string[],
  collegeName?: string,
  coachEmail?: string,
  startTime?: string,
): Promise<void> {
  await db.from("groups").update({
    name,
    student_ids: studentIds,
    college_name: collegeName ?? "",
    coach_email: coachEmail ?? "",
    start_time: startTime ?? "",
  }).eq("id", id);
  invalidateGroups();
}
```

to:

```ts
export async function updateGroup(
  id: string,
  name: string,
  studentIds: string[],
  collegeName?: string,
  coachEmail?: string,
  startTime?: string,
): Promise<void> {
  const { data: existing } = await db
    .from("groups")
    .select("student_ids")
    .eq("id", id)
    .maybeSingle();
  const previousIds: string[] = Array.isArray(existing?.student_ids)
    ? (existing!.student_ids as string[])
    : [];

  await db.from("groups").update({
    name,
    student_ids: studentIds,
    college_name: collegeName ?? "",
    coach_email: coachEmail ?? "",
    start_time: startTime ?? "",
  }).eq("id", id);
  invalidateGroups();

  const previousSet = new Set(previousIds);
  const nextSet = new Set(studentIds);
  const added = studentIds.filter((sid) => !previousSet.has(sid));
  const removed = previousIds.filter((sid) => !nextSet.has(sid));
  await syncGroupMembershipToSessions(id, added, removed);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/groups.ts
git commit -m "feat(groups): sync future sessions when a group's roster is edited"
```

---

### Task 3: Wire `ensureStudentInCollegeGroup` to call the sync

**Files:**
- Modify: `src/lib/sheets/groups.ts` (the existing `ensureStudentInCollegeGroup` function)

- [ ] **Step 1: Call the sync after adding the student to an existing group**

Change:

```ts
  if (data) {
    const group = data as { id: string; student_ids: string[] };
    const ids: string[] = Array.isArray(group.student_ids)
      ? group.student_ids
      : String(group.student_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.includes(studentId)) {
      await db.from("groups").update({ student_ids: [...ids, studentId] }).eq("id", group.id);
      invalidateGroups();
    }
  } else {
    await appendGroup(name, [studentId], name);
  }
```

to:

```ts
  if (data) {
    const group = data as { id: string; student_ids: string[] };
    const ids: string[] = Array.isArray(group.student_ids)
      ? group.student_ids
      : String(group.student_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.includes(studentId)) {
      await db.from("groups").update({ student_ids: [...ids, studentId] }).eq("id", group.id);
      invalidateGroups();
      await syncGroupMembershipToSessions(group.id, [studentId], []);
    }
  } else {
    await appendGroup(name, [studentId], name);
  }
```

Note: the `else` branch (`appendGroup`) intentionally does **not** call the sync — a brand-new group has no sessions yet, per the spec.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/groups.ts
git commit -m "feat(groups): sync future sessions from college auto-add too"
```

---

### Task 4: Full build check and manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project (confirms nothing else references the old 3-argument-only shape of these functions in a way that broke).

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification — addition syncs forward**

Against the dev/staging environment (not production data unless the user explicitly says so):
1. Open `/admin/groups`, pick an existing group that has at least one upcoming session in the schedule (or create a session for a test group first via `/admin/schedule`).
2. Note the group's current roster and the test session's current roster (open the session, check "ניהול מתאמנים").
3. Edit the group and add a student who wasn't previously in it. Save.
4. Re-open the same upcoming session's "ניהול מתאמנים" dialog — confirm the newly added student now appears checked, with no other change to the roster.
5. Confirm a **past** session tied to the same group (if one exists) was **not** modified.

- [ ] **Step 4: Manual verification — removal syncs forward**

1. Edit the same group again and remove a student who is currently in the group.
2. Re-open the upcoming session — confirm that student is no longer checked.
3. Confirm a session with a manually-added "makeup" student (someone not in the group at all, added directly via that session's "ניהול מתאמנים") still has that student — the sync must not have touched them.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check in Steps 3–4 before considering the task done.

---

## Plan Self-Review Notes

- **Spec coverage:** Scope (forward-only, `status != cancelled`), surgical add/remove (not overwrite), no-sync-on-create, both call sites (`updateGroup`, `ensureStudentInCollegeGroup`) are all implemented in Tasks 1–3 and checked in Task 4.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `syncGroupMembershipToSessions(groupId: string, added: string[], removed: string[])` signature is identical across Task 1's definition and Tasks 2–3's call sites.
