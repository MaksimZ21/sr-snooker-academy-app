# CRM Training Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up CRM `event_created` and `appointment_approved` webhooks so training sessions are auto-created with the correct group, coach can be assigned manually, and attendance is tracked from both CRM approvals and coach marking.

**Architecture:** The single `/api/webhooks/crm/training` endpoint dispatches by `event_type`. Sessions are keyed by `crm_appointment_id`. Attendance records use a new `"confirmed"` status for CRM approvals, overrideable by coach. The session detail UI adds a coach-assignment dropdown (admin only) and surfaces the confirmed badge per student.

**Tech Stack:** Next.js App Router, Supabase (service role via `src/lib/db/client.ts`), Zod, TanStack Query, shadcn/ui, Vitest

---

## File Map

| File | Action |
|---|---|
| Supabase SQL migration | `crm_appointment_id` column on `sessions`; attendance status constraint |
| `src/lib/sheets/schemas.ts` | Add `crm_appointment_id` to `SessionRow`; add `"confirmed"` to `AttendanceRow.status`; relax `marked_by` to `z.string()` |
| `src/lib/sheets/schemas.test.ts` | Tests for new schema fields |
| `src/lib/sheets/sessions.ts` | Update `upsertSessionFromCrm`; add `fetchSessionByCrmAppointmentId`; add `updateSessionCoach` |
| `src/app/api/webhooks/crm/training/route.ts` | Full rewrite — dispatch by `event_type`, parse `meeting_time` |
| `src/app/api/sessions/[id]/route.ts` | Add `PATCH` handler for coach assignment |
| `src/components/coach-selector.tsx` | New component — admin-only coach dropdown |
| `src/components/attendance-panel.tsx` | Show `"confirmed"` badge; `"confirmed"` row styling |
| `src/components/session-detail.tsx` | Add `isAdmin` prop; render `CoachSelector` when admin |
| `src/app/(admin)/admin/sessions/[id]/page.tsx` | Pass `isAdmin={true}` |

---

## Task 1: Supabase DB Migration

**Files:**
- Run SQL in Supabase dashboard → SQL Editor

- [ ] **Step 1: Run migration SQL**

Open the Supabase dashboard → SQL Editor → run:

```sql
-- Add crm_appointment_id column to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS crm_appointment_id TEXT DEFAULT '';

-- Add unique partial index so two appointments can't share the same slot
CREATE UNIQUE INDEX IF NOT EXISTS sessions_crm_appointment_id_idx
  ON sessions (crm_appointment_id)
  WHERE crm_appointment_id IS NOT NULL AND crm_appointment_id <> '';

-- Update attendance status constraint to include 'confirmed'
-- Drop old constraint if it exists (name may vary — check in Supabase Table Editor)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'confirmed'));
```

> If the attendance table uses a Postgres enum type instead of a CHECK constraint, run:
> `ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'confirmed';`
> Check Table Editor → attendance → status column type to decide which applies.

- [ ] **Step 2: Verify in Table Editor**

In Supabase → Table Editor → `sessions`: confirm `crm_appointment_id` column exists.
In `attendance`: confirm status column accepts `'confirmed'`.

---

## Task 2: Update Schemas + Tests

**Files:**
- Modify: `src/lib/sheets/schemas.ts`
- Modify: `src/lib/sheets/schemas.test.ts`

- [ ] **Step 1: Update `SessionRow` in `schemas.ts`**

In `src/lib/sheets/schemas.ts`, replace the `SessionRow` definition:

```ts
export const SessionRow = z.object({
  id: z.string().min(1),
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
});
```

- [ ] **Step 2: Update `AttendanceRow` in `schemas.ts`**

Replace the `AttendanceRow` definition:

```ts
export const AttendanceRow = z.object({
  session_id: z.string(),
  student_id: z.string(),
  status: z.enum(["present", "absent", "late", "confirmed"]),
  marked_by: z.string().min(1),
  marked_at: z.string(),
});
export type Attendance = z.infer<typeof AttendanceRow>;
```

- [ ] **Step 3: Write tests in `schemas.test.ts`**

Add these two `describe` blocks at the end of `src/lib/sheets/schemas.test.ts`:

```ts
describe("SessionRow crm_appointment_id", () => {
  it("defaults crm_appointment_id to empty string when missing", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status"],
      ["SES1","2026-05-27","17:00","","c@a.com","group","S1","","scheduled"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].crm_appointment_id).toBe("");
  });

  it("parses crm_appointment_id when present", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status","crm_appointment_id"],
      ["SES1","2026-05-27","17:00","","c@a.com","group","S1","","scheduled","678892"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].crm_appointment_id).toBe("678892");
  });
});

describe("AttendanceRow confirmed status", () => {
  it("accepts confirmed as a valid status", () => {
    const result = AttendanceRow.safeParse({
      session_id: "SES1",
      student_id: "S1",
      status: "confirmed",
      marked_by: "crm",
      marked_at: "2026-05-27T17:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("confirmed");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/schemas.ts src/lib/sheets/schemas.test.ts
git commit -m "feat(schema): add crm_appointment_id to sessions, confirmed status to attendance"
```

---

## Task 3: Update Sessions Lib

**Files:**
- Modify: `src/lib/sheets/sessions.ts`

- [ ] **Step 1: Add `fetchSessionByCrmAppointmentId`**

In `src/lib/sheets/sessions.ts`, add after `fetchSessionById`:

```ts
export async function fetchSessionByCrmAppointmentId(appointmentId: string): Promise<Session | null> {
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("crm_appointment_id", appointmentId)
    .maybeSingle();
  return (data as Session) ?? null;
}
```

- [ ] **Step 2: Add `updateSessionCoach`**

Add after `fetchSessionByCrmAppointmentId`:

```ts
export async function updateSessionCoach(sessionId: string, coachEmail: string): Promise<void> {
  await db
    .from("sessions")
    .update({ coach_email: coachEmail.trim().toLowerCase() })
    .eq("id", sessionId);
  invalidateSessions();
}
```

- [ ] **Step 3: Update `upsertSessionFromCrm`**

Replace the entire `upsertSessionFromCrm` function with:

```ts
export async function upsertSessionFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  date: string;
  start_time: string;
  end_time?: string;
  training_type?: string;
  address?: string;
  crm_event_type?: string;
  group_name?: string;
}): Promise<{ id: string; action: "created" | "updated" }> {
  // Resolve existing session — prefer appointment_id lookup, fall back to event_id
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }
  if (!existing) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  // Resolve group → student_ids
  let studentIds: string[] = [];
  if (input.group_name) {
    const { data: group } = await db
      .from("groups")
      .select("student_ids")
      .ilike("name", input.group_name)
      .maybeSingle();
    if (group) {
      const raw = group.student_ids as unknown;
      studentIds = Array.isArray(raw)
        ? (raw as string[])
        : String(raw ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const fields = {
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time ?? "",
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
  };

  if (existing) {
    await db.from("sessions").update(fields).eq("id", existing.id);
    if (studentIds.length > 0) {
      await db.from("sessions").update({ student_ids: studentIds }).eq("id", existing.id);
    }
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
    coach_email: "",
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
  });
  invalidateSessions();
  return { id, action: "created" };
}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors in `sessions.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/sessions.ts
git commit -m "feat(sessions): add crm_appointment_id lookup, group assignment, coach update"
```

---

## Task 4: Rewrite Training Webhook

**Files:**
- Modify: `src/app/api/webhooks/crm/training/route.ts`

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `src/app/api/webhooks/crm/training/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertSessionFromCrm, fetchSessionByCrmAppointmentId } from "@/lib/sheets/sessions";
import { upsertAttendance } from "@/lib/sheets/attendance";
import { db } from "@/lib/db/client";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student } from "@/lib/sheets/schemas";

function parseMeetingTime(raw: string): { date: string; startTime: string } | null {
  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart || !timePart) return null;
  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) return null;
  return {
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    startTime: timePart,
  };
}

const BasePayload = z.object({
  event_type: z.string(),
  event_id: z.string().min(1),
  appointment_id: z.string().min(1),
  meeting_time: z.string().min(1),
  meeting_type: z.string().default(""),
});

const AppointmentApprovedPayload = BasePayload.extend({
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
});

async function handleEventCreated(raw: Record<string, unknown>) {
  const parsed = BasePayload.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { event_id, appointment_id, meeting_time, meeting_type } = parsed.data;
  const time = parseMeetingTime(meeting_time);
  if (!time) {
    return NextResponse.json({ error: "invalid meeting_time format, expected DD/MM/YYYY HH:MM" }, { status: 422 });
  }
  const result = await upsertSessionFromCrm({
    crm_event_id: event_id,
    crm_appointment_id: appointment_id,
    date: time.date,
    start_time: time.startTime,
    end_time: "",
    group_name: meeting_type || undefined,
    crm_event_type: "event_created",
  });
  return NextResponse.json(result, { status: 200 });
}

async function handleAppointmentApproved(raw: Record<string, unknown>) {
  const parsed = AppointmentApprovedPayload.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { appointment_id, first_name, last_name, phone } = parsed.data;

  const session = await fetchSessionByCrmAppointmentId(appointment_id);
  if (!session) {
    console.warn(`[crm/training] session not found for appointment_id=${appointment_id}`);
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // Find student by phone first, then by full name
  let student: Student | null = null;
  if (phone) {
    const { data } = await db.from("students").select("*").eq("phone", phone.trim()).maybeSingle();
    if (data) student = data as Student;
  }
  if (!student) {
    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim().toLowerCase();
    const { data: all } = await db.from("students").select("*");
    student = ((all ?? []) as Student[]).find(
      (s) => studentFullName(s).toLowerCase() === fullName,
    ) ?? null;
  }

  if (!student) {
    console.warn(`[crm/training] student not found: phone=${phone}, name=${first_name} ${last_name}`);
    return NextResponse.json({ ok: true, warning: "student not found" }, { status: 200 });
  }

  await upsertAttendance({
    session_id: session.id,
    student_id: student.id,
    status: "confirmed",
    marked_by: "crm",
    marked_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, session_id: session.id, student_id: student.id });
}

async function handle(raw: Record<string, unknown>) {
  console.log("[crm/training] received:", JSON.stringify(raw));
  const eventType = String(raw.event_type ?? "");
  if (eventType === "event_created") return handleEventCreated(raw);
  if (eventType === "appointment_approved") return handleAppointmentApproved(raw);
  return NextResponse.json({ ok: true, skipped: true, event_type: eventType });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return handle(Object.fromEntries(searchParams.entries()));
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  if (contentType.includes("application/json")) {
    body = await req.json();
  } else {
    const { searchParams } = new URL(req.url);
    body = Object.fromEntries(searchParams.entries());
  }
  return handle(body);
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/crm/training/route.ts
git commit -m "feat(webhook): rewrite crm/training to handle event_created and appointment_approved"
```

---

## Task 5: Add PATCH Endpoint for Coach Assignment

**Files:**
- Modify: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Add PATCH handler**

Open `src/app/api/sessions/[id]/route.ts` and add at the end of the file:

```ts
import { updateSessionCoach } from "@/lib/sheets/sessions";

const PatchBody = z.object({
  coach_email: z.string(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    await updateSessionCoach(id, body.coach_email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

Add `import { z } from "zod";` at the top if not already present (it isn't — add it).

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/route.ts
git commit -m "feat(api): add PATCH /sessions/[id] for coach assignment"
```

---

## Task 6: CoachSelector Component

**Files:**
- Create: `src/components/coach-selector.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/coach-selector.tsx`:

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Coach = { email: string; name: string; active: boolean };

export function CoachSelector({
  sessionId,
  currentCoachEmail,
}: {
  sessionId: string;
  currentCoachEmail: string;
}) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
  });

  const mut = useMutation({
    mutationFn: async (coachEmail: string) => {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coach_email: coachEmail }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("המאמן עודכן");
    },
    onError: () => toast.error("שגיאה בשמירת המאמן"),
  });

  const coaches = (data?.coaches ?? []).filter((c) => c.active);
  const value = currentCoachEmail || "__none__";

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/60 text-xs">מאמן</span>
      <Select
        value={value}
        onValueChange={(v) => mut.mutate(v === "__none__" ? "" : v)}
        disabled={mut.isPending}
      >
        <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-8 w-44">
          <SelectValue placeholder="לא משובץ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">לא משובץ</SelectItem>
          {coaches.map((c) => (
            <SelectItem key={c.email} value={c.email}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/components/coach-selector.tsx
git commit -m "feat(ui): add CoachSelector component for admin coach assignment"
```

---

## Task 7: Update AttendancePanel for "confirmed" Status

**Files:**
- Modify: `src/components/attendance-panel.tsx`

- [ ] **Step 1: Add `"confirmed"` handling**

In `src/components/attendance-panel.tsx`, make these changes:

1. Add import for `Badge` at the top:
```ts
import { Badge } from "@/components/ui/badge";
```

2. After the `STATUSES` array, add a constant for confirmed styling:
```ts
const CONFIRMED_ROW_CLASS = "border-blue-400/60 bg-blue-50/60 dark:bg-blue-950/20";
```

3. In the `statusFor` return, the type now includes `"confirmed"`. Update the row rendering inside `students.map`:

Replace this block:
```tsx
const cur = statusFor(s.id);
const curConfig = STATUSES.find((st) => st.key === cur);
return (
  <div
    key={s.id}
    className={cn(
      "flex justify-between items-center border-2 rounded-xl p-3.5 transition-all duration-200",
      curConfig ? curConfig.rowClass : "border-border",
    )}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none transition-colors",
          curConfig ? curConfig.avatarClass : "bg-muted text-muted-foreground",
        )}
      >
        {getInitials(studentFullName(s))}
      </div>
      <div className="font-medium text-sm">{studentFullName(s)}</div>
    </div>
```

With:
```tsx
const cur = statusFor(s.id);
const isConfirmed = cur === "confirmed";
const curConfig = STATUSES.find((st) => st.key === cur);
return (
  <div
    key={s.id}
    className={cn(
      "flex justify-between items-center border-2 rounded-xl p-3.5 transition-all duration-200",
      curConfig ? curConfig.rowClass : isConfirmed ? CONFIRMED_ROW_CLASS : "border-border",
    )}
  >
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none transition-colors",
          curConfig ? curConfig.avatarClass : "bg-muted text-muted-foreground",
        )}
      >
        {getInitials(studentFullName(s))}
      </div>
      <div className="flex items-center gap-2">
        <div className="font-medium text-sm">{studentFullName(s)}</div>
        {isConfirmed && (
          <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400">
            אישר הגעה
          </Badge>
        )}
      </div>
    </div>
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/components/attendance-panel.tsx
git commit -m "feat(ui): show confirmed badge in attendance panel for CRM approvals"
```

---

## Task 8: Update SessionDetail — isAdmin + CoachSelector

**Files:**
- Modify: `src/components/session-detail.tsx`

- [ ] **Step 1: Add `isAdmin` prop and `CoachSelector` import**

In `src/components/session-detail.tsx`:

1. Add import at the top:
```ts
import { CoachSelector } from "./coach-selector";
```

2. Update the props type and destructure:
```tsx
export function SessionDetail({
  sessionId,
  canEditAttendance,
  canEditNotes,
  isAdmin = false,
}: {
  sessionId: string;
  canEditAttendance: boolean;
  canEditNotes: boolean;
  isAdmin?: boolean;
}) {
```

3. In the gradient header section, after the date `<p>` line (`<p className="text-white/50 text-xs mt-3 relative">{formatHebrewDate(session.date)}</p>`), add:

```tsx
{isAdmin && (
  <div className="mt-3 relative">
    <CoachSelector sessionId={sessionId} currentCoachEmail={session.coach_email} />
  </div>
)}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/components/session-detail.tsx
git commit -m "feat(ui): add isAdmin prop to SessionDetail, show CoachSelector for admins"
```

---

## Task 9: Wire Up Admin Session Page

**Files:**
- Modify: `src/app/(admin)/admin/sessions/[id]/page.tsx`

- [ ] **Step 1: Pass `isAdmin` prop**

In `src/app/(admin)/admin/sessions/[id]/page.tsx`, update the `SessionDetail` usage:

```tsx
<SessionDetail sessionId={id} canEditAttendance={true} canEditNotes={false} isAdmin={true} />
```

- [ ] **Step 2: Full build + tests**

```bash
npm run build 2>&1 | head -60
npm run test:run
```

Expected: clean build, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/sessions/[id]/page.tsx
git commit -m "feat(admin): enable coach assignment and attendance on session detail"
```

---

## Self-Review

**Spec coverage:**
- ✅ `event_created` → session created with group students via `upsertSessionFromCrm` (Task 4)
- ✅ `appointment_approved` → attendance `"confirmed"` via CRM (Task 4)
- ✅ `crm_appointment_id` stored for unique session matching (Tasks 1, 2, 3)
- ✅ `meeting_time` parsed DD/MM/YYYY HH:MM → date + start_time (Task 4)
- ✅ `end_time` left empty (Task 3)
- ✅ Group matched by `meeting_type` (case-insensitive, Tasks 3)
- ✅ Coach assignment: PATCH API (Task 5) + CoachSelector UI admin-only (Tasks 6, 8, 9)
- ✅ Attendance marking: coach + admin (already had `canEditAttendance={true}` on both pages)
- ✅ `"confirmed"` badge in AttendancePanel (Task 7)
- ✅ Sessions visible in schedule grid (no change needed — weekly grid already reads all sessions)

**Type consistency:**
- `fetchSessionByCrmAppointmentId` returns `Session | null` — used correctly in Task 4
- `updateSessionCoach` called in PATCH route with `(id, body.coach_email)` — matches Task 3 signature
- `CoachSelector` props `{ sessionId, currentCoachEmail }` — used correctly in Task 8 with `session.coach_email`
- `AttendanceRow.status` now includes `"confirmed"` — `isConfirmed = cur === "confirmed"` is valid in Task 7
