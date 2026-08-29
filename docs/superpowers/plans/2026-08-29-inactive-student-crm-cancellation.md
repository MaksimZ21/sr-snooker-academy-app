# Inactive Student → WhatsApp Removal + CRM Cancellation Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student transitions from active to inactive — whether an admin toggles it by hand in the edit-student dialog, or the CRM webhook reports a cancelled/frozen subscription — automatically attempt to remove them from their matching WhatsApp group, best-effort and silent-with-a-gentle-toast.

**Architecture:** `updateStudent()` becomes the single place that detects a genuine `active: true → false` transition and reacts to it (WhatsApp removal). `upsertStudentFromCrm`'s existing-student path is rewritten to call `updateStudent()` instead of its own raw `db.update()`, so a CRM-driven deactivation gets the exact same side effect as a manual admin edit — no duplicated logic. A new `group_name` field on the CRM payload (`"מנויים מבוטלים"` / `"מנויים מוקפאים"`) drives the deactivation; a new placeholder-stripping helper protects `college_group`/`college_name` from the CRM's literal unresolved-template strings.

**Tech Stack:** Next.js API routes, Supabase (`db` service-role client), Green API (WhatsApp), zod, TanStack Query, sonner toasts.

**Specs:**
- `docs/superpowers/specs/2026-08-29-inactive-student-whatsapp-removal-design.md`
- `docs/superpowers/specs/2026-08-29-crm-cancelled-subscription-design.md`

---

### Task 1: Add `removeWhatsAppGroupParticipant` to the Green API client

**Files:**
- Modify: `src/lib/whatsapp/greenapi.ts`

- [ ] **Step 1: Append the new function to the end of the file**

Add after the existing `updateGroupSettings` function (after line 137):

```ts

// groupId is already fully-qualified (e.g. from getWhatsAppGroups, ending
// in @g.us) — participantPhone goes through the same toChatId/formatPhone
// conversion as every other phone-identified call in this file.
export async function removeWhatsAppGroupParticipant(
  groupId: string,
  participantPhone: string,
): Promise<void> {
  const participantChatId = toChatId(participantPhone);
  const res = await fetch(`${BASE()}/removeGroupParticipant/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, participantChatId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API removeGroupParticipant ${res.status}: ${text}`);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/greenapi.ts
git commit -m "feat: add removeWhatsAppGroupParticipant to Green API client"
```

---

### Task 2: Add loose name matching + best-effort removal helper to `groups.ts`

**Files:**
- Modify: `src/lib/sheets/groups.ts`

- [ ] **Step 1: Add the Green API import**

In the import block at the top of the file, change:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { invalidateSessions } from "./sessions";
import { todayIsoTel } from "@/lib/date";
import type { Group } from "./schemas";
```

to:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { invalidateSessions } from "./sessions";
import { todayIsoTel } from "@/lib/date";
import { getWhatsAppGroups, removeWhatsAppGroupParticipant } from "@/lib/whatsapp/greenapi";
import type { Group } from "./schemas";
```

- [ ] **Step 2: Append the two new functions at the end of the file**

Add after `syncGroupMembershipToSessions` (after the closing `}` that currently ends the file):

```ts

// Loose name match used to pair an internal `groups` row with its live
// WhatsApp counterpart: case-insensitive, and tolerant of either name
// being a superset of the other (WhatsApp group names often carry extra
// decoration, e.g. "🎱 מכללת תל אביב 🎱" vs the internal "מכללת תל אביב").
export function namesLooselyMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Best-effort: when a student becomes inactive, find the WhatsApp group
// that matches one of their internal groups and remove them from it.
// Never throws — every failure mode (no phone on file, not in any internal
// group, Green API unreachable, no WhatsApp group name matches, the
// removal call itself failing) is swallowed and reported back as "nothing
// removed," since this always runs as a side effect of a student-status
// change that must itself succeed regardless of WhatsApp's outcome.
export async function removeStudentFromMatchingWhatsAppGroup(
  studentId: string,
  phone: string,
): Promise<string | null> {
  if (!phone.trim()) return null;

  const allGroups = await fetchGroupsAll();
  const memberOf = allGroups.filter((g) => g.student_ids.includes(studentId));
  if (!memberOf.length) return null;

  let waGroups: { id: string; name: string }[];
  try {
    waGroups = await getWhatsAppGroups();
  } catch {
    return null;
  }

  for (const internalGroup of memberOf) {
    const match = waGroups.find((wa) => namesLooselyMatch(wa.name, internalGroup.name));
    if (match) {
      try {
        await removeWhatsAppGroupParticipant(match.id, phone);
        return match.name;
      } catch {
        return null;
      }
    }
  }
  return null;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/groups.ts
git commit -m "feat: add removeStudentFromMatchingWhatsAppGroup helper"
```

---

### Task 3: Wire transition-detection + WhatsApp removal into `updateStudent`

**Files:**
- Modify: `src/lib/sheets/students.ts`

- [ ] **Step 1: Add `removeStudentFromMatchingWhatsAppGroup` to the groups import**

Change:

```ts
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup } from "./groups";
```

to:

```ts
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup, removeStudentFromMatchingWhatsAppGroup } from "./groups";
```

- [ ] **Step 2: Replace `updateStudent` entirely**

Replace the current function:

```ts
export async function updateStudent(
  id: string,
  input: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    college_name?: string;
    subscription_type?: string;
    general_notes?: string;
    birth_date?: string | null;
    last_payment_date?: string | null;
    active?: boolean;
  },
): Promise<void> {
  await db.from("students").update(input).eq("id", id);
  revalidateTag("students", { expire: 0 });
}
```

with:

```ts
export async function updateStudent(
  id: string,
  input: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    college_name?: string;
    subscription_type?: string;
    general_notes?: string;
    birth_date?: string | null;
    last_payment_date?: string | null;
    active?: boolean;
  },
): Promise<{ whatsAppRemovalAttempted: boolean; removedFromWhatsAppGroup: string | null }> {
  // Only an actual true→false transition attempts a WhatsApp removal — a
  // re-save of an already-inactive student (input.active === false again)
  // must not re-trigger it. Read the CURRENT value before applying the
  // update to tell the two apart.
  let becameInactive = false;
  if (input.active === false) {
    const { data: before } = await db.from("students").select("active").eq("id", id).maybeSingle();
    becameInactive = before?.active === true;
  }

  await db.from("students").update(input).eq("id", id);
  revalidateTag("students", { expire: 0 });

  if (!becameInactive) {
    return { whatsAppRemovalAttempted: false, removedFromWhatsAppGroup: null };
  }

  const { data: after } = await db.from("students").select("phone").eq("id", id).maybeSingle();
  const removedFromWhatsAppGroup = await removeStudentFromMatchingWhatsAppGroup(id, (after?.phone as string) ?? "");
  return { whatsAppRemovalAttempted: true, removedFromWhatsAppGroup };
}
```

Every existing caller of `updateStudent` only used it for its side effect (none read a return value, since it used to return `void`), so widening the return type doesn't break any other call site.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the two remaining call sites — the PATCH route in Task 4, and `upsertStudentFromCrm` after Task 6 — are updated in later steps).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/students.ts
git commit -m "feat: detect active-to-inactive transition in updateStudent, trigger WhatsApp removal"
```

---

### Task 4: Surface the removal outcome from `PATCH /api/students/[id]`

**Files:**
- Modify: `src/app/api/students/[id]/route.ts`

- [ ] **Step 1: Return the extra fields**

Change:

```ts
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    await updateStudent(id, body);
    return NextResponse.json({ ok: true });
```

to:

```ts
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    const result = await updateStudent(id, body);
    return NextResponse.json({ ok: true, ...result });
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/students/[id]/route.ts
git commit -m "feat: return WhatsApp removal outcome from student PATCH route"
```

---

### Task 5: Gentle toast in the edit-student dialog

**Files:**
- Modify: `src/components/forms/edit-student-dialog.tsx`

- [ ] **Step 1: Read the response body and add the extra toast**

Change the mutation:

```ts
  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType.trim(),
          general_notes: notes.trim(),
          birth_date: birthDate || null,
          last_payment_date: lastPaymentDate || null,
          active,
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הפרטים עודכנו");
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: () => toast.error("שגיאה בעדכון הפרטים"),
  });
```

to:

```ts
  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType.trim(),
          general_notes: notes.trim(),
          birth_date: birthDate || null,
          last_payment_date: lastPaymentDate || null,
          active,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as {
        whatsAppRemovalAttempted: boolean;
        removedFromWhatsAppGroup: string | null;
      };
    },
    onSuccess: (result) => {
      toast.success("הפרטים עודכנו");
      if (result.whatsAppRemovalAttempted) {
        if (result.removedFromWhatsAppGroup) {
          toast.info(`הוסר גם מקבוצת הוואטסאפ '${result.removedFromWhatsAppGroup}'`);
        } else {
          toast.info("לא נמצאה קבוצת וואטסאפ מתאימה להסרה");
        }
      }
      qc.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
    },
    onError: () => toast.error("שגיאה בעדכון הפרטים"),
  });
```

- [ ] **Step 2: Confirm `toast.info` exists on this project's sonner wrapper**

Run: `grep -n "toast\." src/components/*.tsx src/components/**/*.tsx 2>/dev/null | grep -i "toast.info" | head -5`

`sonner`'s default export includes `.info` out of the box, so no extra setup is needed — this step is just a sanity check that no custom wrapper shadows it. If nothing turns up, that's fine (no prior usage doesn't mean it's unavailable); proceed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/edit-student-dialog.tsx
git commit -m "feat: show gentle toast when a student is removed from their WhatsApp group"
```

---

### Task 6: CRM cancelled/frozen detection + placeholder stripping in `upsertStudentFromCrm`

**Files:**
- Modify: `src/lib/sheets/students.ts`

- [ ] **Step 1: Replace the file's top section (imports through `assignGroupFromCrm`)**

Replace:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup, removeStudentFromMatchingWhatsAppGroup } from "./groups";
import type { Student } from "./schemas";

export type CrmStudent = {
  first_name: string;
  last_name: string;
  phone?: string;
  email: string;
  college_name?: string;
  college_group?: string;
  subscription_type?: string;
  birth_date?: string | null;
};

// Resolves group placement from a CRM payload. `college_group` (a specific
// cohort/time-slot name) takes priority when present — it only ever joins
// an EXISTING matching group, never creates one, and does NOT fall back to
// the college_name flow if no match is found (per explicit product
// decision, 2026-08-28): an admin handles that case manually rather than
// the student silently landing in the wrong (college-wide) group. Only
// when `college_group` is absent does the older college_name find-or-create
// behavior apply, unchanged.
async function assignGroupFromCrm(input: CrmStudent, studentId: string): Promise<boolean> {
  if (input.college_group) {
    return assignStudentToExistingGroup(input.college_group, studentId);
  }
  if (input.college_name) {
    await ensureStudentInCollegeGroup(input.college_name, studentId);
    return true;
  }
  return false;
}
```

with:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup, removeStudentFromMatchingWhatsAppGroup } from "./groups";
import type { Student } from "./schemas";

export type CrmStudent = {
  first_name: string;
  last_name: string;
  phone?: string;
  email: string;
  college_name?: string;
  college_group?: string;
  group_name?: string;
  subscription_type?: string;
  birth_date?: string | null;
};

// The CRM sends some fields as its own unresolved template placeholder
// text (e.g. "{college_group}") when that variable doesn't apply to a
// given event — treat that exactly like the field being absent, rather
// than using the literal placeholder string as if it were real data.
// Scoped to college_group/college_name, the only two fields the
// group-matching logic below reads.
function stripCrmPlaceholder(value?: string): string | undefined {
  if (value === undefined) return undefined;
  return /^\{.*\}$/.test(value.trim()) ? undefined : value;
}

// Resolves group placement from a CRM payload. `collegeGroup` (a specific
// cohort/time-slot name) takes priority when present — it only ever joins
// an EXISTING matching group, never creates one, and does NOT fall back to
// the college_name flow if no match is found (per explicit product
// decision, 2026-08-28): an admin handles that case manually rather than
// the student silently landing in the wrong (college-wide) group. Only
// when `collegeGroup` is absent does the older college_name find-or-create
// behavior apply, unchanged.
async function assignGroupFromCrm(
  collegeGroup: string | undefined,
  collegeName: string | undefined,
  studentId: string,
): Promise<boolean> {
  if (collegeGroup) {
    return assignStudentToExistingGroup(collegeGroup, studentId);
  }
  if (collegeName) {
    await ensureStudentInCollegeGroup(collegeName, studentId);
    return true;
  }
  return false;
}

// The CRM's two known values for a cancelled/frozen subscription — when
// group_name matches either (after trimming), the student is (re)saved as
// inactive, which drives the WhatsApp-removal side effect inside
// updateStudent(). No other group_name value is treated specially.
function isCancelledOrFrozen(groupName: string | undefined): boolean {
  const trimmed = groupName?.trim();
  return trimmed === "מנויים מבוטלים" || trimmed === "מנויים מוקפאים";
}
```

- [ ] **Step 2: Replace `upsertStudentFromCrm`**

Replace:

```ts
export async function upsertStudentFromCrm(input: CrmStudent) {
  // match by email first, then by phone
  let existing: { id: string } | null = null;

  if (input.email) {
    const { data } = await db.from("students").select("id").eq("email", input.email).maybeSingle();
    existing = data as { id: string } | null;
  }

  if (!existing && input.phone) {
    const { data } = await db.from("students").select("id").eq("phone", input.phone).maybeSingle();
    existing = data as { id: string } | null;
  }

  if (existing) {
    await db.from("students").update({
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone ?? "",
      college_name: input.college_name ?? "",
      subscription_type: input.subscription_type ?? "",
      ...(input.birth_date !== undefined && { birth_date: input.birth_date }),
    }).eq("id", existing.id);
    revalidateTag("students", { expire: 0 });
    const group_assigned = await assignGroupFromCrm(input, existing.id as string);
    return { id: existing.id as string, action: "updated" as const, group_assigned };
  }

  const id = await appendStudent(input);
  const group_assigned = await assignGroupFromCrm(input, id);
  return { id, action: "created" as const, group_assigned };
}
```

with:

```ts
export async function upsertStudentFromCrm(input: CrmStudent) {
  // match by email first, then by phone
  let existing: { id: string } | null = null;

  if (input.email) {
    const { data } = await db.from("students").select("id").eq("email", input.email).maybeSingle();
    existing = data as { id: string } | null;
  }

  if (!existing && input.phone) {
    const { data } = await db.from("students").select("id").eq("phone", input.phone).maybeSingle();
    existing = data as { id: string } | null;
  }

  const collegeName = stripCrmPlaceholder(input.college_name);
  const collegeGroup = stripCrmPlaceholder(input.college_group);
  const cancelledOrFrozen = isCancelledOrFrozen(input.group_name);

  if (existing) {
    // Routed through updateStudent() — not a raw db.update() — so a
    // cancelled/frozen subscription reported here transitions the student
    // to inactive through the exact same path a manual admin edit does,
    // including the WhatsApp-removal side effect. When not
    // cancelled/frozen, `active` is omitted entirely so a routine CRM sync
    // never overwrites a manually-set inactive status back to active.
    const updateResult = await updateStudent(existing.id as string, {
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone ?? "",
      college_name: collegeName ?? "",
      subscription_type: input.subscription_type ?? "",
      ...(input.birth_date !== undefined && { birth_date: input.birth_date }),
      ...(cancelledOrFrozen && { active: false }),
    });
    const group_assigned = await assignGroupFromCrm(collegeGroup, collegeName, existing.id as string);
    return { id: existing.id as string, action: "updated" as const, group_assigned, ...updateResult };
  }

  const id = await appendStudent({
    ...input,
    college_name: collegeName,
    active: cancelledOrFrozen ? false : undefined,
  });
  const group_assigned = await assignGroupFromCrm(collegeGroup, collegeName, id);
  return {
    id,
    action: "created" as const,
    group_assigned,
    whatsAppRemovalAttempted: false,
    removedFromWhatsAppGroup: null,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/students.ts
git commit -m "feat: detect CRM cancelled/frozen subscription, strip placeholder fields"
```

---

### Task 7: Accept `group_name` on the CRM webhook route

**Files:**
- Modify: `src/app/api/webhooks/crm/route.ts`

- [ ] **Step 1: Add the field to `CrmQuery`**

Change:

```ts
const CrmQuery = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().email(),
  college_name: z.string().optional(),
  college_group: z.string().optional(),
  subscription_type: z.string().optional(),
  birthday: z.string().optional(), // DD/MM/YYYY from CRM
});
```

to:

```ts
const CrmQuery = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().email(),
  college_name: z.string().optional(),
  college_group: z.string().optional(),
  group_name: z.string().optional(),
  subscription_type: z.string().optional(),
  birthday: z.string().optional(), // DD/MM/YYYY from CRM
});
```

No other change is needed in this file — `parsed.data` (including the new optional `group_name`) is already spread wholesale into the object passed to `upsertStudentFromCrm`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/crm/route.ts
git commit -m "feat: accept group_name on the CRM webhook to detect cancelled/frozen subscriptions"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Full test run**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature adds no new test files — every new function here either wraps a live Green API call or touches the `db` service-role client, matching the existing untested pattern for this class of function in `groups.ts`/`students.ts`/`greenapi.ts`; there is no test file importing any of these three modules today).

- [ ] **Step 3: Manual sanity check — admin toggle path**

In the running app (`npm run dev`), open `/admin/students`, edit a student who is currently active and belongs to a group whose name closely matches a real WhatsApp group, switch their status to "לא פעיל", save. Confirm:
- The usual "הפרטים עודכנו" toast appears.
- A second toast appears — either the "הוסר גם מקבוצת הוואטסאפ" success message, or the "לא נמצאה קבוצת וואטסאפ מתאימה" fallback.
- Re-saving the same (already-inactive) student again does NOT show the second toast (confirms the true→false-only transition guard).

- [ ] **Step 4: Manual sanity check — CRM path**

Using `curl` (or the CRM sandbox if available), hit the webhook with a `group_name` of `מנויים מבוטלים` for an existing active student's email, e.g.:

```bash
curl -G "http://localhost:3000/api/webhooks/crm" \
  --data-urlencode "first_name=בדיקה" \
  --data-urlencode "email=<an existing active student's email>" \
  --data-urlencode "group_name=מנויים מבוטלים"
```

Confirm the JSON response includes `"action":"updated"`, `"whatsAppRemovalAttempted":true`, and check `/admin/students` that the student is now inactive. Then check `/admin/webhook-logs` to confirm the log entry recorded the same result.

- [ ] **Step 5: Push**

```bash
git push origin main
```

- [ ] **Step 6: Report to the user (in Hebrew)**

Summarize what shipped: manual deactivation now best-effort removes the student from their matching WhatsApp group with a gentle toast either way; the CRM webhook now recognizes `group_name` = "מנויים מבוטלים"/"מנויים מוקפאים" and automatically deactivates the student, triggering the same WhatsApp removal; CRM placeholder text like `"{college_group}"` is now ignored instead of being used as a real value.
