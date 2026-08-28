# Monthly Personal Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student picks one of four fixed improvement categories for the current month in their personal area; every session that month, their coach records a number matching that category (success-count-out-of-attempts for three categories, a single "best break" for the fourth) in a new tab on the session detail page; the student (and staff, on the student's existing detail pages) can see a chart of that month's progress at any time.

**Architecture:** Two new tables (`student_monthly_goals`, `student_goal_entries`) behind a new `src/lib/sheets/monthly-goals.ts` data module — the only place that queries `db` for this feature. All months are computed in Israel local time via the existing `todayIsoTel()` helper (never raw UTC), matching a timezone bug already fixed once elsewhere in this codebase. The chart is a small `GoalChart` component using this codebase's existing lazy-loaded-Recharts pattern (`next/dynamic`, `ssr: false`), reused in three places: the student's own page, and a small self-contained read-only widget dropped into the two existing staff-facing student detail pages without touching those pages' existing data-fetching.

**Tech Stack:** TypeScript, Next.js 16, Supabase, Zod, TanStack Query, React 19, Recharts, Tailwind CSS v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-28-monthly-goal-design.md`

**Testing note:** No test coverage for `src/lib/sheets/`, API routes, or `src/components/` per established convention. `npx tsc --noEmit` and `npm run test:run` are the automated gates; the final task covers manual verification. The migration is applied manually by the user via the Supabase SQL Editor.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260828_student_monthly_goals.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE student_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id),
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month)
);

CREATE TABLE student_goal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES student_monthly_goals(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  success_count INT,
  attempt_count INT,
  best_break INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, session_id)
);

ALTER TABLE student_monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_goal_entries ENABLE ROW LEVEL SECURITY;
```

`month` is a plain `"YYYY-MM"` string, not a date type — it's never used in
a date computation, only equality-matched against a string the app computes
itself, so a simple `TEXT` column keeps this simple and avoids timezone
ambiguity at the database layer entirely.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260828_student_monthly_goals.sql
git commit -m "feat(goals): add monthly goal schema migration"
```

- [ ] **Step 3: Note for the user**

Flag clearly in your final report that this migration must be run manually
in the Supabase SQL Editor before this feature works.

---

### Task 2: `monthly-goals.ts` data module

**Files:**
- Create: `src/lib/sheets/monthly-goals.ts`

- [ ] **Step 1: Write the data module**

```ts
import { db } from "@/lib/db/client";
import { todayIsoTel } from "@/lib/date";

export type GoalCategory = "technique" | "angle" | "cue_ball_control" | "breaks";

export const GOAL_CATEGORIES: { key: GoalCategory; label: string; description: string }[] = [
  { key: "technique", label: "טכניקה", description: "שיפור כניסה למכה ו/או הוצאת המכה" },
  { key: "angle", label: "זווית", description: "שיפור אחוז ההצלחה בהכנסת כדורים ממרחקים קצרים" },
  { key: "cue_ball_control", label: "שליטה בלבן", description: "שיפור הדיוק בשליטה בלבן בנוסף להכנסת כדורים" },
  { key: "breaks", label: "ברייקים", description: "שיפור הרצף האישי שלי" },
];

export type MonthlyGoal = {
  id: string;
  student_id: string;
  month: string;
  category: GoalCategory;
  created_at: string;
};

export type GoalEntry = {
  id: string;
  goal_id: string;
  session_id: string;
  success_count: number | null;
  attempt_count: number | null;
  best_break: number | null;
  created_at: string;
};

// Every month computation in this file goes through here — never raw
// `new Date()`/`toISOString()`, which is UTC and can disagree with the
// Israel-local calendar month near midnight (the same class of bug fixed
// once already in this codebase's group-session sync).
export function currentMonth(): string {
  return todayIsoTel().slice(0, 7);
}

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export async function fetchStudentGoals(
  studentId: string,
): Promise<{ goal: MonthlyGoal; entries: GoalEntry[] }[]> {
  const { data: goals } = await db
    .from("student_monthly_goals")
    .select("*")
    .eq("student_id", studentId)
    .order("month", { ascending: false });
  const goalRows = (goals ?? []) as MonthlyGoal[];
  if (!goalRows.length) return [];

  const goalIds = goalRows.map((g) => g.id);
  const { data: entries } = await db
    .from("student_goal_entries")
    .select("*")
    .in("goal_id", goalIds)
    .order("created_at", { ascending: true });
  const entryRows = (entries ?? []) as GoalEntry[];

  return goalRows.map((goal) => ({
    goal,
    entries: entryRows.filter((e) => e.goal_id === goal.id),
  }));
}

export async function fetchGoalForMonth(studentId: string, month: string): Promise<MonthlyGoal | null> {
  const { data } = await db
    .from("student_monthly_goals")
    .select("*")
    .eq("student_id", studentId)
    .eq("month", month)
    .maybeSingle();
  return (data as MonthlyGoal) ?? null;
}

export async function createMonthlyGoal(studentId: string, category: GoalCategory): Promise<MonthlyGoal> {
  const { data, error } = await db
    .from("student_monthly_goals")
    .insert({ student_id: studentId, month: currentMonth(), category })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("כבר נבחרה מטרה החודש");
    throw new Error(error.message);
  }
  return data as MonthlyGoal;
}

export async function fetchGoalsForSessionStudents(
  sessionId: string,
  studentIds: string[],
  sessionMonth: string,
): Promise<Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }>> {
  const result: Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }> = {};
  for (const id of studentIds) result[id] = { goal: null, entry: null };
  if (!studentIds.length) return result;

  const { data: goals } = await db
    .from("student_monthly_goals")
    .select("*")
    .in("student_id", studentIds)
    .eq("month", sessionMonth);
  const goalRows = (goals ?? []) as MonthlyGoal[];
  if (!goalRows.length) return result;

  const goalIds = goalRows.map((g) => g.id);
  const { data: entries } = await db
    .from("student_goal_entries")
    .select("*")
    .in("goal_id", goalIds)
    .eq("session_id", sessionId);
  const entryRows = (entries ?? []) as GoalEntry[];

  for (const goal of goalRows) {
    result[goal.student_id] = {
      goal,
      entry: entryRows.find((e) => e.goal_id === goal.id) ?? null,
    };
  }
  return result;
}

export async function upsertGoalEntry(
  sessionId: string,
  goalId: string,
  input: { successCount: number; attemptCount: number } | { bestBreak: number },
): Promise<void> {
  const row =
    "bestBreak" in input
      ? { goal_id: goalId, session_id: sessionId, success_count: null, attempt_count: null, best_break: input.bestBreak }
      : { goal_id: goalId, session_id: sessionId, success_count: input.successCount, attempt_count: input.attemptCount, best_break: null };
  const { error } = await db
    .from("student_goal_entries")
    .upsert(row, { onConflict: "goal_id,session_id" });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/monthly-goals.ts
git commit -m "feat(goals): add monthly goal data module"
```

---

### Task 3: API routes — student goal pick and fetch

**Files:**
- Create: `src/app/api/students/[id]/monthly-goal/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudentGoals, createMonthlyGoal } from "@/lib/sheets/monthly-goals";
import { getStudentByEmail } from "@/lib/sheets/students";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (user.role === "student") {
      const self = await getStudentByEmail(user.email);
      if (!self || self.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const goals = await fetchStudentGoals(id);
    return NextResponse.json({ goals });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  category: z.enum(["technique", "angle", "cue_ball_control", "breaks"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const self = await getStudentByEmail(user.email);
    if (!self || self.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { category } = CreateSchema.parse(await req.json());
    const goal = await createMonthlyGoal(id, category);
    return NextResponse.json({ goal });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message === "כבר נבחרה מטרה החודש") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

`GET` is reachable by the student themselves (their own id only, verified
by matching their session email to the resolved `students` row) or by
admin/coach (any id) — matching the spec's stated access rule. `POST` is
self-service only: a student picking their own goal, never staff acting on
their behalf, per the approved design.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/students/[id]/monthly-goal/route.ts"
git commit -m "feat(goals): add student monthly-goal fetch/create API route"
```

---

### Task 4: API route — coach records a session's entry

**Files:**
- Create: `src/app/api/sessions/[id]/goal-entries/[studentId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { fetchGoalForMonth, upsertGoalEntry, monthOf } from "@/lib/sheets/monthly-goals";

const EntrySchema = z.union([
  z.object({ successCount: z.number().int().nonnegative(), attemptCount: z.number().int().positive() }),
  z.object({ bestBreak: z.number().int().nonnegative() }),
]);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, studentId } = await params;
    const session = await fetchSessionById(id);
    if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const goal = await fetchGoalForMonth(studentId, monthOf(session.date));
    if (!goal) return NextResponse.json({ error: "no goal this month" }, { status: 400 });

    const body = EntrySchema.parse(await req.json());
    if (goal.category === "breaks" && !("bestBreak" in body)) {
      return NextResponse.json({ error: "expected bestBreak for this category" }, { status: 400 });
    }
    if (goal.category !== "breaks" && !("successCount" in body)) {
      return NextResponse.json({ error: "expected successCount/attemptCount for this category" }, { status: 400 });
    }

    await upsertGoalEntry(id, goal.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

This mirrors the existing `GET /api/sessions/[id]` route's exact
admin-or-assigned-coach authorization pattern (`session.coach_email !==
user.email` check for the `coach` role).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/sessions/[id]/goal-entries/[studentId]/route.ts"
git commit -m "feat(goals): add session goal-entry API route"
```

---

### Task 5: Extend session detail API with goal data

**Files:**
- Modify: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Add the import**

Change:
```ts
import { fetchNotesForSessionStudents } from "@/lib/sheets/notes";
```
to:
```ts
import { fetchNotesForSessionStudents } from "@/lib/sheets/notes";
import { fetchGoalsForSessionStudents, monthOf } from "@/lib/sheets/monthly-goals";
```

- [ ] **Step 2: Fetch and include goal data in the response**

Change:
```ts
    const notesByStudent = await fetchNotesForSessionStudents(
      id,
      sessionStudents.map((s) => s.id),
    );
    return NextResponse.json({
      session,
      students: sessionStudents,
      attendance,
      notesByStudent,
    });
```
to:
```ts
    const notesByStudent = await fetchNotesForSessionStudents(
      id,
      sessionStudents.map((s) => s.id),
    );
    const goalsByStudent = await fetchGoalsForSessionStudents(
      id,
      sessionStudents.map((s) => s.id),
      monthOf(session.date),
    );
    return NextResponse.json({
      session,
      students: sessionStudents,
      attendance,
      notesByStudent,
      goalsByStudent,
    });
```

Do not touch `PATCH`/`DELETE` in this same file — out of scope.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: `src/components/session-detail.tsx` will now be out of sync with
the new response shape (it doesn't read `goalsByStudent` yet) — this
doesn't cause a typecheck error since that component's `Detail` type is
declared independently and TypeScript can't see the mismatch against a
runtime JSON shape; no error expected from this task, but the new field
being unused there is intentional until Task 6.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/sessions/[id]/route.ts"
git commit -m "feat(goals): include goal data in session detail API response"
```

---

### Task 6: `GoalPanel` component and session-detail wiring

**Files:**
- Create: `src/components/goal-panel.tsx`
- Modify: `src/components/session-detail.tsx`

- [ ] **Step 1: Write `GoalPanel`**

```tsx
"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";
import { GOAL_CATEGORIES, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals";

export type GoalsByStudent = Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }>;

export function GoalPanel({
  sessionId,
  students,
  goalsByStudent,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  goalsByStudent: GoalsByStudent;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 mt-4">
      {students.map((s) => {
        const info = goalsByStudent[s.id];
        if (!info?.goal) {
          return (
            <div key={s.id} className="flex items-center gap-3 border-2 rounded-xl p-3.5 border-border">
              <div className="font-medium text-sm flex-1">{studentFullName(s)}</div>
              <span className="text-xs text-muted-foreground">לא נבחרה מטרה החודש</span>
            </div>
          );
        }
        return (
          <GoalEntryRow
            key={s.id}
            sessionId={sessionId}
            studentId={s.id}
            studentName={studentFullName(s)}
            goal={info.goal}
            entry={info.entry}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function GoalEntryRow({
  sessionId,
  studentId,
  studentName,
  goal,
  entry,
  readOnly,
}: {
  sessionId: string;
  studentId: string;
  studentName: string;
  goal: MonthlyGoal;
  entry: GoalEntry | null;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const [success, setSuccess] = useState(entry?.success_count?.toString() ?? "");
  const [attempts, setAttempts] = useState(entry?.attempt_count?.toString() ?? "");
  const [bestBreak, setBestBreak] = useState(entry?.best_break?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const label = GOAL_CATEGORIES.find((c) => c.key === goal.category)?.label ?? goal.category;
  const isBreaks = goal.category === "breaks";
  const canSave = isBreaks ? bestBreak !== "" : success !== "" && attempts !== "";

  async function save() {
    setSaving(true);
    try {
      const body = isBreaks
        ? { bestBreak: Number(bestBreak) }
        : { successCount: Number(success), attemptCount: Number(attempts) };
      const r = await fetch(`/api/sessions/${sessionId}/goal-entries/${studentId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
      await qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("נשמר");
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-2 rounded-xl p-3.5 border-border flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <div className="font-medium text-sm">{studentName}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      {readOnly ? (
        <span className="text-sm">
          {isBreaks
            ? entry?.best_break !== null && entry?.best_break !== undefined
              ? `רצף: ${entry.best_break}`
              : "טרם נרשם"
            : entry?.success_count !== null && entry?.success_count !== undefined
              ? `${entry.success_count} מתוך ${entry.attempt_count}`
              : "טרם נרשם"}
        </span>
      ) : isBreaks ? (
        <>
          <Input
            type="number"
            min={0}
            value={bestBreak}
            onChange={(e) => setBestBreak(e.target.value)}
            placeholder="הרצף הגבוה ביותר"
            className="h-8 w-32 text-sm"
          />
          <Button size="sm" disabled={saving || !canSave} onClick={save} className="h-8 text-xs">
            שמור
          </Button>
        </>
      ) : (
        <>
          <Input
            type="number"
            min={0}
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
            placeholder="הצליחו"
            className="h-8 w-20 text-sm text-center"
          />
          <span className="text-muted-foreground text-xs">מתוך</span>
          <Input
            type="number"
            min={0}
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
            placeholder="ניסיונות"
            className="h-8 w-20 text-sm text-center"
          />
          <Button size="sm" disabled={saving || !canSave} onClick={save} className="h-8 text-xs">
            שמור
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the third tab into `session-detail.tsx`**

Change:
```ts
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
```
to:
```ts
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { GoalPanel, type GoalsByStudent } from "./goal-panel";
```

Change:
```ts
type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
};
```
to:
```ts
type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
  goalsByStudent: GoalsByStudent;
};
```

Change:
```ts
  const { session, students, attendance, notesByStudent } = data;
```
to:
```ts
  const { session, students, attendance, notesByStudent, goalsByStudent } = data;
```

Change:
```tsx
        <Tabs defaultValue="attendance">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="notes">הערות</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <AttendancePanel
              sessionId={sessionId}
              students={students}
              attendance={attendance}
              readOnly={!canEditAttendance}
            />
          </TabsContent>
          <TabsContent value="notes">
            <NotesPanel
              sessionId={sessionId}
              students={students}
              notesByStudent={notesByStudent}
              readOnly={!canEditNotes}
            />
          </TabsContent>
        </Tabs>
```
to:
```tsx
        <Tabs defaultValue="attendance">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="notes">הערות</TabsTrigger>
            <TabsTrigger value="goal">מטרה</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <AttendancePanel
              sessionId={sessionId}
              students={students}
              attendance={attendance}
              readOnly={!canEditAttendance}
            />
          </TabsContent>
          <TabsContent value="notes">
            <NotesPanel
              sessionId={sessionId}
              students={students}
              notesByStudent={notesByStudent}
              readOnly={!canEditNotes}
            />
          </TabsContent>
          <TabsContent value="goal">
            <GoalPanel
              sessionId={sessionId}
              students={students}
              goalsByStudent={goalsByStudent}
              readOnly={!canEditAttendance}
            />
          </TabsContent>
        </Tabs>
```

The goal tab follows `canEditAttendance` (not a separate permission), per
the spec's explicit note that it's filled during the same live session as
attendance.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/goal-panel.tsx src/components/session-detail.tsx
git commit -m "feat(goals): add goal tab to the session detail page"
```

---

### Task 7: `GoalChart` component

**Files:**
- Create: `src/components/goal-chart.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { GoalCategory, GoalEntry } from "@/lib/sheets/monthly-goals";

export function GoalChart({ entries, category }: { entries: GoalEntry[]; category: GoalCategory }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">עדיין אין נתונים החודש</p>;
  }

  const data = entries.map((e, i) => ({
    session: `אימון ${i + 1}`,
    value:
      category === "breaks"
        ? e.best_break ?? 0
        : Math.round(((e.success_count ?? 0) / (e.attempt_count || 1)) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="session" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          allowDecimals={false}
          unit={category === "breaks" ? "" : "%"}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
          }}
          formatter={(v) => [category === "breaks" ? `${v}` : `${v}%`, ""]}
        />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

This component is imported only via `next/dynamic({ ssr: false })` at every
call site (Tasks 8 and 9) — matching this codebase's established
lazy-loaded-Recharts convention (`coach-charts.tsx`/`admin-charts.tsx`),
so Recharts itself never ends up in the main bundle.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/goal-chart.tsx
git commit -m "feat(goals): add monthly goal progress chart component"
```

---

### Task 8: Student-facing goal page

**Files:**
- Create: `src/components/student-goal-view.tsx`
- Create: `src/app/(student)/student/goal/page.tsx`
- Modify: `src/components/nav-items.ts`

- [ ] **Step 1: Write `StudentGoalView`**

```tsx
"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GOAL_CATEGORIES, currentMonth, type GoalCategory, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals";

const GoalChart = dynamic(() => import("./goal-chart").then((m) => m.GoalChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

type GoalWithEntries = { goal: MonthlyGoal; entries: GoalEntry[] };

export function StudentGoalView({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<GoalCategory | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-goals", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/monthly-goal`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { goals: GoalWithEntries[] };
    },
  });

  const pickMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const r = await fetch(`/api/students/${studentId}/monthly-goal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: selected }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => {
      toast.success("המטרה נשמרה");
      qc.invalidateQueries({ queryKey: ["student-goals", studentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const goals = data.goals;
  const current = goals.find((g) => g.goal.month === currentMonth());
  const past = goals.filter((g) => g.goal.month !== currentMonth());

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <h1 className="text-lg font-semibold">המטרה שלי</h1>

      {!current ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            מטרת העל שלי לחודש הקרוב - אני הכי רוצה לשפר את:
          </p>
          <div className="flex flex-col gap-2">
            {GOAL_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c.key)}
                className={cn(
                  "text-right rounded-xl border-2 p-3 transition-colors",
                  selected === c.key ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
                )}
              >
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
              </button>
            ))}
          </div>
          <Button disabled={!selected || pickMut.isPending} onClick={() => pickMut.mutate()}>
            {pickMut.isPending ? "שומר..." : "אישור"}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            המטרה שלי החודש · {GOAL_CATEGORIES.find((c) => c.key === current.goal.category)?.label}
          </p>
          <GoalChart entries={current.entries} category={current.goal.category} />
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">חודשים קודמים</p>
          {past.map((g) => (
            <PastGoalRow key={g.goal.id} item={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function PastGoalRow({ item }: { item: GoalWithEntries }) {
  const [open, setOpen] = useState(false);
  const label = GOAL_CATEGORIES.find((c) => c.key === item.goal.category)?.label ?? item.goal.category;
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right px-4 py-3 text-sm font-medium"
      >
        {item.goal.month} · {label}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <GoalChart entries={item.entries} category={item.goal.category} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { StudentGoalView } from "@/components/student-goal-view";

export default async function StudentGoalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user.email) redirect("/login");
  const student = await getStudentByEmail(session.user.email);
  if (!student) redirect("/student");
  return <StudentGoalView studentId={student.id} />;
}
```

- [ ] **Step 3: Add the nav entry**

Read `src/components/nav-items.ts` first to confirm its exact current
`STUDENT_NAV` content, then add
`{ href: "/student/goal", label: "המטרה שלי", icon: "Target" }` right after
the first entry (`/student`, "האימונים שלי") — before "היסטוריה" —
preserving everything else exactly as-is. Check the same icon-resolution
concern noted in the tournaments plan (`src/components/app-shell.tsx`'s
`ICON_MAP`) and register `Target` there too if it's a hardcoded map rather
than a dynamic lucide-react lookup.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/student-goal-view.tsx "src/app/(student)/student/goal/page.tsx" src/components/nav-items.ts src/components/app-shell.tsx
git commit -m "feat(goals): add student-facing monthly goal page"
```

(Only include `src/components/app-shell.tsx` in the `git add` if Step 3
actually needed to touch it.)

---

### Task 9: Staff-facing read-only goal summary

**Files:**
- Create: `src/components/student-goal-summary.tsx`
- Modify: `src/app/(admin)/admin/students/[id]/page.tsx`
- Modify: `src/app/(coach)/coach/students/[id]/page.tsx`

- [ ] **Step 1: Write the self-contained summary widget**

```tsx
"use client";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_CATEGORIES, currentMonth, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals";

const GoalChart = dynamic(() => import("./goal-chart").then((m) => m.GoalChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

export function StudentGoalSummary({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-goals", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/monthly-goal`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { goals: { goal: MonthlyGoal; entries: GoalEntry[] }[] };
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const current = data?.goals.find((g) => g.goal.month === currentMonth());
  if (!current) return null;

  const label = GOAL_CATEGORIES.find((c) => c.key === current.goal.category)?.label ?? current.goal.category;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        מטרה חודשית · {label}
      </p>
      <GoalChart entries={current.entries} category={current.goal.category} />
    </div>
  );
}
```

This widget does its own data fetching (reusing the same
`GET /api/students/[id]/monthly-goal` route Task 3 already built) and
renders nothing (`null`) if the student has no goal set for the current
month — deliberately NOT touching either page's existing combined
data-fetch/`Detail` type, since both pages already assemble a fairly large
response from their own dedicated endpoints and this is a small, optional,
independent addition.

- [ ] **Step 2: Drop it into the admin student detail page**

Read `src/app/(admin)/admin/students/[id]/page.tsx` in full first. Add an
import:
```ts
import { StudentGoalSummary } from "@/components/student-goal-summary";
```
Then insert `<StudentGoalSummary studentId={student.id} />` (using
whatever the loaded student object's variable name actually is in this
file — confirm from context) somewhere reasonable in the page's layout —
e.g. right after the general notes / basic-info section and before the
assessments list, matching the page's existing card-based
`rounded-2xl border ... bg-card` visual rhythm. Since this is a
self-contained, independent addition with no dependency on the rest of the
page's data, exact placement is a judgment call — pick a sensible spot,
don't restructure anything else on the page.

- [ ] **Step 3: Drop it into the coach student detail page**

Read `src/app/(coach)/coach/students/[id]/page.tsx` in full first, and
apply the same kind of insertion there, matching that page's own layout
conventions (which may differ slightly from the admin page's).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 5: Commit**

```bash
git add src/components/student-goal-summary.tsx "src/app/(admin)/admin/students/[id]/page.tsx" "src/app/(coach)/coach/students/[id]/page.tsx"
git commit -m "feat(goals): show read-only monthly goal progress on student detail pages"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature touches no tested
files).

- [ ] **Step 3: Remind the user about the manual migration**

State explicitly that Task 1's migration must be run in the Supabase SQL
Editor before this feature works, and wait for confirmation before manual
QA.

- [ ] **Step 4: Manual end-to-end verification**

Once the migration is applied:

1. As a student (logged in), go to "המטרה שלי" — confirm the four
   categories render with the exact labels/descriptions from the spec,
   pick one, confirm it saves and the picker is replaced by a chart
   showing "עדיין אין נתונים החודש" (no entries yet).
2. Try picking again (e.g. by hitting the API directly, since the UI no
   longer shows a picker) — confirm the server rejects a second goal for
   the same month with the friendly "כבר נבחרה מטרה החודש" message.
3. As the coach for a session that includes this student, open that
   session and go to the new "מטרה" tab — confirm the student's row shows
   their chosen category with the correct input shape (two number fields
   for a X/Y category, or one for breaks), enter a value, save — confirm
   it persists on reload.
4. Back on the student's own "המטרה שלי" page, confirm the chart now shows
   one data point matching what the coach entered.
5. For a DIFFERENT student in the same session who has NOT picked a goal
   this month, confirm their row in the "מטרה" tab shows "לא נבחרה מטרה
   החודש" with no input.
6. As a non-assigned coach (or the student's own read-only view of another
   session), confirm the "מטרה" tab shows values read-only (no input
   fields, no save button) when `readOnly` is true.
7. On the student's `/admin/students/[id]` and `/coach/students/[id]`
   pages, confirm the same chart appears read-only for staff, and confirm
   it doesn't render anything (no broken empty card) for a student who has
   never picked a goal.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check, and confirm the migration reminder was
acknowledged.

---

## Plan Self-Review Notes

- **Spec coverage:** all four categories with exact labels/descriptions
  (Task 2, reused verbatim in Task 8's picker), the coach-facing per-session
  entry tab (Tasks 4-6), the student-facing picker + chart + history (Task
  8), the staff-facing read-only summary on both existing student detail
  pages (Task 9), and the exact authorization rules from the spec's API
  section (self-service POST, admin/coach/self GET, admin/assigned-coach
  PUT) are all covered.
- **No placeholders:** every step has complete, exact code, except Task 9's
  page-insertion steps, which are deliberately open-ended (read-first,
  judgment-call placement) since they're additive, low-risk insertions into
  two existing files whose exact current content wasn't read while writing
  this plan — flagged explicitly as such rather than guessing wrong exact
  text and calling it precise.
- **Type consistency:** `GoalCategory`, `MonthlyGoal`, `GoalEntry`,
  `GOAL_CATEGORIES`, `currentMonth`, `monthOf` are all defined once in
  `monthly-goals.ts` (Task 2) and imported (never redefined) by every other
  task. `GoalsByStudent` is defined once in `goal-panel.tsx` (Task 6) and
  imported by `session-detail.tsx`. The `GoalChart` component (Task 7) has
  one implementation, dynamically imported identically by both Task 8 and
  Task 9's call sites.
- **Timezone correctness:** every month computation goes through
  `currentMonth()`/`monthOf()` in the one shared data module, both built on
  `todayIsoTel()` — never raw `Date`/`toISOString()`, matching the lesson
  from this codebase's own group-session-sync timezone bug fixed earlier
  this session.
