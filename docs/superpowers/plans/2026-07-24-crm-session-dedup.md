# CRM/Manual Session Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the CRM webhook from creating a duplicate session when a matching session (same group, date, and start time) was already created manually in the app — attach the CRM's identifiers to the existing session instead, without touching anything the admin already entered.

**Architecture:** Persist a new `group_id` column on `sessions`, set it on both creation paths (the manual "הוסף מפגש" dialog and the CRM `upsertSessionFromCrm` upsert), then extend `upsertSessionFromCrm`'s existing CRM-id-based matching with one more fallback lookup by `group_id` + `date` + `start_time` before it falls through to creating a new session.

**Tech Stack:** Next.js 16 API routes, Supabase (Postgres), zod, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-24-crm-session-dedup-design.md`

**Conventions note:** same as the prior two plans in this repo — no test coverage exists for API routes or components, so this plan verifies each step with `npx tsc --noEmit` plus a manual check, and there's no Supabase CLI/migration runner wired up, so Task 1's migration must be applied by hand in the Supabase SQL Editor.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260724_sessions_group_id.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS group_id text;
```

- [ ] **Step 2: Apply it manually in Supabase**

Open the Supabase project → SQL Editor → paste the contents of the file above → Run.
Expected: no error; a new nullable `group_id` column exists on `sessions`. Verify with:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'sessions' and column_name = 'group_id';
```
Expected result: one row, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260724_sessions_group_id.sql
git commit -m "feat(db): add group_id column to sessions"
```

---

### Task 2: Add `group_id` to the Session schema

**Files:**
- Modify: `src/lib/sheets/schemas.ts`

- [ ] **Step 1: Add `group_id` to `SessionRow`**

Find:
```ts
export const SessionRow = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string().default(""),
  coach_email: z.union([z.email(), z.literal("")]).default(""),
  training_type: TrainingType,
  student_ids: Csv,
  drive_folder_url: z.string().default(""),
  address: z.string().default(""),
  crm_event_id: z.string().default(""),
  crm_event_type: z.string().default(""),
  crm_appointment_id: z.string().default(""),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  price_nis: z.coerce.number().int().nullable().default(null),
  source: z.string().default(""),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
```
Replace with:
```ts
export const SessionRow = z.object({
  id: z.string().min(1),
  name: z.string().default(""),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string().default(""),
  coach_email: z.union([z.email(), z.literal("")]).default(""),
  training_type: TrainingType,
  student_ids: Csv,
  drive_folder_url: z.string().default(""),
  address: z.string().default(""),
  crm_event_id: z.string().default(""),
  crm_event_type: z.string().default(""),
  crm_appointment_id: z.string().default(""),
  group_id: z.string().nullable().default(null),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  price_nis: z.coerce.number().int().nullable().default(null),
  source: z.string().default(""),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this repo's Supabase client has no generated `Database` type, so `.insert()`/`.update()` calls aren't checked against this schema — a clean `tsc` here does not by itself prove Tasks 3/6 are correct; those tasks must be verified by reading the diff, not by trusting `tsc` alone).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/schemas.ts
git commit -m "feat(sessions): add group_id to Session schema"
```

---

### Task 3: Thread `group_id` through `appendSession`

**Files:**
- Modify: `src/lib/sheets/sessions.ts`

- [ ] **Step 1: Accept and insert the field**

Find:
```ts
export async function appendSession(input: {
  date: string;
  start_time: string;
  end_time: string;
  coach_email: string;
  training_type: string;
  student_ids: string[];
  drive_folder_url?: string;
}) {
  const prefix = `SES-${input.date}-`;
  const { data } = await db.from("sessions").select("id").like("id", `${prefix}%`);
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `${prefix}${String(next).padStart(3, "0")}`;
  await db.from("sessions").insert({
    id,
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    coach_email: input.coach_email.trim().toLowerCase(),
    training_type: input.training_type,
    student_ids: input.student_ids,
    drive_folder_url: input.drive_folder_url ?? "",
    status: "scheduled",
  });
  invalidateSessions();
  return id;
}
```
Replace with:
```ts
export async function appendSession(input: {
  date: string;
  start_time: string;
  end_time: string;
  coach_email: string;
  training_type: string;
  student_ids: string[];
  drive_folder_url?: string;
  group_id?: string | null;
}) {
  const prefix = `SES-${input.date}-`;
  const { data } = await db.from("sessions").select("id").like("id", `${prefix}%`);
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `${prefix}${String(next).padStart(3, "0")}`;
  await db.from("sessions").insert({
    id,
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    coach_email: input.coach_email.trim().toLowerCase(),
    training_type: input.training_type,
    student_ids: input.student_ids,
    drive_folder_url: input.drive_folder_url ?? "",
    group_id: input.group_id ?? null,
    status: "scheduled",
  });
  invalidateSessions();
  return id;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/sessions.ts
git commit -m "feat(sessions): thread group_id through appendSession"
```

---

### Task 4: Accept `group_id` in `POST /api/sessions`

**Files:**
- Modify: `src/app/api/sessions/route.ts`

- [ ] **Step 1: Add it to the body schema**

Find:
```ts
    const body = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().min(1),
        end_time: z.string().min(1),
        coach_email: z.email(),
        training_type: TrainingType,
        student_ids: z.array(z.string().min(1)).min(1),
        drive_folder_url: z.string().optional(),
      })
      .parse(await req.json());
```
Replace with:
```ts
    const body = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().min(1),
        end_time: z.string().min(1),
        coach_email: z.email(),
        training_type: TrainingType,
        student_ids: z.array(z.string().min(1)).min(1),
        drive_folder_url: z.string().optional(),
        group_id: z.string().nullable().optional(),
      })
      .parse(await req.json());
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/route.ts
git commit -m "feat(api): accept group_id when creating a session"
```

---

### Task 5: Persist `group_id` from the add-session dialog

**Files:**
- Modify: `src/components/forms/add-session-dialog.tsx`

- [ ] **Step 1: Add state for the selected group**

Find:
```tsx
  const [driveUrl, setDriveUrl] = useState("");
  const [search, setSearch] = useState("");
```
Replace with:
```tsx
  const [driveUrl, setDriveUrl] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
```

- [ ] **Step 2: Capture it when a group is applied via the "הוסף קבוצה שלמה..." picker**

Find:
```tsx
  function applyGroup(groupId: string | null) {
    const group = groupsQ.data?.groups.find((g) => g.id === groupId);
    if (!group) return;
    setStudentIds((prev) => [...new Set([...prev, ...group.student_ids])]);
    if (group.coach_email) setCoachEmail(group.coach_email);
    if (group.start_time) {
      setStartTime(group.start_time);
      setEndTime(addMinutes(group.start_time, 90));
    }
  }
```
Replace with:
```tsx
  function applyGroup(groupId: string | null) {
    const group = groupsQ.data?.groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedGroupId(groupId);
    setStudentIds((prev) => [...new Set([...prev, ...group.student_ids])]);
    if (group.coach_email) setCoachEmail(group.coach_email);
    if (group.start_time) {
      setStartTime(group.start_time);
      setEndTime(addMinutes(group.start_time, 90));
    }
  }
```

- [ ] **Step 3: Also carry it over when copying an existing session**

This is important: the admin's actual current workflow for pre-creating sessions is the "העתק מאימון קיים" (copy from existing session) picker at the top of this dialog, powered by `applySession`. If that function doesn't also copy `group_id`, sessions created by copying would never get the deduplication benefit this whole feature exists for.

Find:
```tsx
  function applySession(sessionId: string | null) {
    const s = recentSessionsQ.data?.find((x) => x.id === sessionId);
    if (!s) return;
    setStartTime(s.start_time);
    setEndTime(s.end_time);
    setCoachEmail(s.coach_email);
    setTrainingType(s.training_type);
    setStudentIds(s.student_ids);
    setDriveUrl(s.drive_folder_url ?? "");
  }
```
Replace with:
```tsx
  function applySession(sessionId: string | null) {
    const s = recentSessionsQ.data?.find((x) => x.id === sessionId);
    if (!s) return;
    setStartTime(s.start_time);
    setEndTime(s.end_time);
    setCoachEmail(s.coach_email);
    setTrainingType(s.training_type);
    setStudentIds(s.student_ids);
    setDriveUrl(s.drive_folder_url ?? "");
    setSelectedGroupId(s.group_id ?? null);
  }
```

- [ ] **Step 4: Reset it alongside the other fields**

Find:
```tsx
  const reset = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setCoachEmail("");
    setTrainingType("");
    setStudentIds([]);
    setDriveUrl("");
    setSearch("");
    setRepeatEnabled(false);
    setRepeatCount(4);
    setRepeatInterval(7);
  };
```
Replace with:
```tsx
  const reset = () => {
    setDate("");
    setStartTime("");
    setEndTime("");
    setCoachEmail("");
    setTrainingType("");
    setStudentIds([]);
    setDriveUrl("");
    setSelectedGroupId(null);
    setSearch("");
    setRepeatEnabled(false);
    setRepeatCount(4);
    setRepeatInterval(7);
  };
```

- [ ] **Step 5: Include it in the POST body**

Find:
```tsx
          body: JSON.stringify({
            date: d,
            start_time: startTime,
            end_time: endTime,
            coach_email: coachEmail,
            training_type: trainingType,
            student_ids: studentIds,
            drive_folder_url: driveUrl || undefined,
          }),
```
Replace with:
```tsx
          body: JSON.stringify({
            date: d,
            start_time: startTime,
            end_time: endTime,
            coach_email: coachEmail,
            training_type: trainingType,
            student_ids: studentIds,
            drive_folder_url: driveUrl || undefined,
            group_id: selectedGroupId,
          }),
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual check**

Run: `npm run dev`, open `/admin/schedule` as an admin, click "הוסף מפגש". Pick a training type other than "private" so the group picker shows, pick a group from "הוסף קבוצה שלמה...", fill in a date, save. This step can't be fully verified without a live database in this sandbox — confirm at minimum that the dialog still opens, the group picker still works, and no console errors appear when submitting.

- [ ] **Step 8: Commit**

```bash
git add src/components/forms/add-session-dialog.tsx
git commit -m "feat(sessions): persist group_id from the add-session dialog"
```

---

### Task 6: Resolve `group_id` and add the dedup fallback in `upsertSessionFromCrm`

**Files:**
- Modify: `src/lib/sheets/sessions.ts`

- [ ] **Step 1: Replace the whole function**

This task changes several connected parts of `upsertSessionFromCrm` at once (the return type, the group-resolution query, the `fields` object, and a new lookup inserted before the "create new" fallback), so it's given here as one complete function replacement rather than several small find/replace edits — apply it as a single, exact swap.

Find the entire existing function (from `export async function upsertSessionFromCrm` through its closing `}`):
```ts
export async function upsertSessionFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  name?: string;
  date: string;
  start_time: string;
  end_time?: string;
  training_type?: string;
  address?: string;
  crm_event_type?: string;
  group_name?: string;
}): Promise<{ id: string; action: "created" | "updated" }> {
  // Resolve existing session.
  // appointment_id is unique per occurrence — use it when available, never fall back to event_id.
  // event_id identifies the recurring series and is reused across sessions, so only use it as
  // a fallback when no appointment_id was provided (legacy / non-recurring events).
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  // Resolve group → student_ids + coach_email
  // First tries exact match, then checks if any group name is contained within the CRM name
  // (e.g. CRM sends "מכללה חיפה" but group is named "חיפה")
  let studentIds: string[] = [];
  let resolvedCoachEmail = "";
  if (input.group_name) {
    const { data: allGroups } = await db.from("groups").select("name, student_ids, coach_email");
    const groups = (allGroups ?? []) as { name: string; student_ids: unknown; coach_email: string }[];
    const crmName = input.group_name.trim().toLowerCase();
    const matched =
      groups.find((g) => g.name.trim().toLowerCase() === crmName) ??
      groups.find((g) => crmName.includes(g.name.trim().toLowerCase()));
    if (matched) {
      const raw = matched.student_ids as unknown;
      studentIds = Array.isArray(raw)
        ? (raw as string[])
        : String(raw ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      resolvedCoachEmail = matched.coach_email ?? "";
    }
  }

  const endTime = input.end_time || addMinutes(input.start_time, 90);

  const fields = {
    name: input.name ?? "",
    date: input.date,
    start_time: input.start_time,
    end_time: endTime,
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
  };

  if (existing) {
    const updateData = {
      ...fields,
      ...(studentIds.length > 0 && { student_ids: studentIds }),
      ...(resolvedCoachEmail && { coach_email: resolvedCoachEmail }),
    };
    await db.from("sessions").update(updateData).eq("id", existing.id);
    invalidateSessions();
    return { id: existing.id as string, action: "updated" };
  }

  const prefix = `SES-${input.date}-`;
  const { data } = await db.from("sessions").select("id").like("id", `${prefix}%`);
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `${prefix}${String(next).padStart(3, "0")}`;

  await db.from("sessions").insert({
    id,
    ...fields,
    coach_email: resolvedCoachEmail,
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
  });
  invalidateSessions();
  return { id, action: "created" };
}
```

Replace with:
```ts
export async function upsertSessionFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  name?: string;
  date: string;
  start_time: string;
  end_time?: string;
  training_type?: string;
  address?: string;
  crm_event_type?: string;
  group_name?: string;
}): Promise<{ id: string; action: "created" | "updated" | "attached" }> {
  // Resolve existing session.
  // appointment_id is unique per occurrence — use it when available, never fall back to event_id.
  // event_id identifies the recurring series and is reused across sessions, so only use it as
  // a fallback when no appointment_id was provided (legacy / non-recurring events).
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  // Resolve group → student_ids + coach_email + group_id
  // First tries exact match, then checks if any group name is contained within the CRM name
  // (e.g. CRM sends "מכללה חיפה" but group is named "חיפה")
  let studentIds: string[] = [];
  let resolvedCoachEmail = "";
  let resolvedGroupId: string | null = null;
  if (input.group_name) {
    const { data: allGroups } = await db.from("groups").select("id, name, student_ids, coach_email");
    const groups = (allGroups ?? []) as { id: string; name: string; student_ids: unknown; coach_email: string }[];
    const crmName = input.group_name.trim().toLowerCase();
    const matched =
      groups.find((g) => g.name.trim().toLowerCase() === crmName) ??
      groups.find((g) => crmName.includes(g.name.trim().toLowerCase()));
    if (matched) {
      const raw = matched.student_ids as unknown;
      studentIds = Array.isArray(raw)
        ? (raw as string[])
        : String(raw ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      resolvedCoachEmail = matched.coach_email ?? "";
      resolvedGroupId = matched.id;
    }
  }

  const endTime = input.end_time || addMinutes(input.start_time, 90);

  const fields = {
    name: input.name ?? "",
    date: input.date,
    start_time: input.start_time,
    end_time: endTime,
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
    group_id: resolvedGroupId,
  };

  if (existing) {
    const updateData = {
      ...fields,
      ...(studentIds.length > 0 && { student_ids: studentIds }),
      ...(resolvedCoachEmail && { coach_email: resolvedCoachEmail }),
    };
    await db.from("sessions").update(updateData).eq("id", existing.id);
    invalidateSessions();
    return { id: existing.id as string, action: "updated" };
  }

  // No session linked to this CRM id yet. Before creating a new one, check whether a
  // session for the same group/date/time was already created manually in the app —
  // if so, attach this CRM appointment to it instead of creating a duplicate. Only the
  // CRM linkage fields are touched here; date/time/roster/coach stay exactly as the
  // admin entered them.
  if (resolvedGroupId) {
    const { data: manualMatches } = await db
      .from("sessions")
      .select("id")
      .eq("group_id", resolvedGroupId)
      .eq("date", input.date)
      .eq("start_time", input.start_time)
      .order("id")
      .limit(1);
    const manualMatch = (manualMatches ?? [])[0] as { id: string } | undefined;
    if (manualMatch) {
      await db
        .from("sessions")
        .update({
          crm_event_id: input.crm_event_id,
          crm_appointment_id: input.crm_appointment_id ?? "",
          crm_event_type: input.crm_event_type ?? "",
          group_id: resolvedGroupId,
        })
        .eq("id", manualMatch.id);
      invalidateSessions();
      return { id: manualMatch.id, action: "attached" };
    }
  }

  const prefix = `SES-${input.date}-`;
  const { data } = await db.from("sessions").select("id").like("id", `${prefix}%`);
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `${prefix}${String(next).padStart(3, "0")}`;

  await db.from("sessions").insert({
    id,
    ...fields,
    coach_email: resolvedCoachEmail,
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
  });
  invalidateSessions();
  return { id, action: "created" };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Remember (per the Conventions note at the top of this plan) that a clean `tsc` here does not prove correctness — this repo's Supabase client isn't typed against the schema, so verify the diff by reading it, not just by the type-checker passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/sessions.ts
git commit -m "feat(sessions): attach CRM appointments to matching manual sessions instead of duplicating"
```

---

### Task 7: Full build and end-to-end check

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors. (Note: in a sandbox without real Supabase credentials in `.env.local`, this step may fail during "Collecting page data" with `supabaseUrl is required` on some unrelated pre-existing route — that's an environment limitation, not a regression, as seen on the two prior plans in this repo. Rely on `npx tsc --noEmit` having passed on every task instead, and run the real `npm run build` wherever real credentials are configured before deploying.)

- [ ] **Step 2: Apply the migration and confirm end-to-end, using real Supabase credentials**

1. Confirm the migration from Task 1 has been applied (`group_id` column exists on `sessions`).
2. In `/admin/schedule`, create a session via "הוסף מפגש", picking a real group from "הוסף קבוצה שלמה..." (or via "העתק מאימון קיים" copying a session that already has a `group_id`, once at least one session has been created the first way). Note the date and start time used.
3. Query the row directly to confirm `group_id` was saved:
```sql
select id, group_id, date, start_time, crm_appointment_id
from sessions
where date = '<the date you used>'
order by id desc
limit 5;
```
4. Trigger the CRM training webhook for an `event_created` event with a `meeting_title` that resolves (via the existing fuzzy-match logic) to the same group, and the same date/time as the session created in step 2 — e.g.:
```
GET /api/webhooks/crm/training?event_type=event_created&event_id=test-evt-1&appointment_id=test-appt-1&meeting_time=<DD/MM/YYYY HH:MM matching the session>&meeting_title=<the group's name>
```
5. Confirm: no new session was created (still the same one row from step 2/3, now with `crm_appointment_id = test-appt-1` and `crm_event_id = test-evt-1`); its `date`, `start_time`, `end_time`, `training_type`, and `student_ids` are unchanged from what was entered manually. Check `/admin/webhook-logs` for a log entry with `result.action: "attached"`.
6. Send an `appointment_approved` event for `appointment_id=test-appt-1` with a `phone` matching one of the session's students, and confirm attendance gets recorded against that same session (proves the `crm_appointment_id` linkage set by the "attach" path works for downstream attendance webhooks, unchanged from today's behavior).
7. Repeat steps 4–5 with a `meeting_time` that does NOT match any existing manual session's date/time for that group, and confirm a brand-new session is created as before (unaffected by this change).
