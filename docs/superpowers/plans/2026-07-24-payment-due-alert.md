# Payment-Due Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a dashboard alert listing active students who haven't paid in 30+ days (or have no payment date on file at all), driven by a new manually-edited `last_payment_date` field on students.

**Architecture:** One new nullable `date` column on `students`, surfaced in the existing add/edit-student dialogs exactly like the existing `birth_date` field, folded into the existing `/api/admin/stats` alert computation (which already does an identical staleness check for absent students), and rendered as a new dashboard card copied from the existing "לא הגיעו 3 שבועות" card.

**Tech Stack:** Next.js 16 API routes, Supabase (Postgres), zod, TanStack Query, date-fns, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-24-payment-due-alert-design.md`

**Conventions note:** as with the previous plan in this repo, there's no test coverage for API routes or components (only pure logic in `src/lib/auth/*`, `src/lib/date.ts`, `src/lib/sheets/schemas.ts`). This plan verifies each step with `npx tsc --noEmit` plus a manual check, matching that established pattern. There's also no Supabase CLI/migration runner wired up in this project — migration files in `supabase/migrations/` are applied by hand in the Supabase SQL Editor, so Task 1's "run" step is manual, not a command this plan can execute.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260724_students_last_payment_date.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_payment_date date;
```

- [ ] **Step 2: Apply it manually in Supabase**

Open the Supabase project → SQL Editor → paste the contents of the file above → Run.
Expected: no error; a new nullable `last_payment_date` column exists on `students`. Verify with:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'students' and column_name = 'last_payment_date';
```
Expected result: one row, `data_type = date`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260724_students_last_payment_date.sql
git commit -m "feat(db): add last_payment_date column to students"
```

---

### Task 2: Add the field to the Student schema

**Files:**
- Modify: `src/lib/sheets/schemas.ts`

- [ ] **Step 1: Add `last_payment_date` to `StudentRow`**

Find:
```ts
export const StudentRow = z.object({
  id: z.string().min(1),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  college_name: z.string().default(""),
  subscription_type: z.string().default(""),
  general_notes: z.string().default(""),
  birth_date: z.string().nullable().default(null),
  active: Bool,
});
```
Replace with:
```ts
export const StudentRow = z.object({
  id: z.string().min(1),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  college_name: z.string().default(""),
  subscription_type: z.string().default(""),
  general_notes: z.string().default(""),
  birth_date: z.string().nullable().default(null),
  last_payment_date: z.string().nullable().default(null),
  active: Bool,
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors listing every place that constructs a `Student`-shaped object without `last_payment_date` — this is expected right now (Tasks 3–4 fix these). Confirm the errors are only in `src/lib/sheets/students.ts` (the `appendStudent`/`updateStudent`/insert call sites) and nowhere else.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/schemas.ts
git commit -m "feat(students): add last_payment_date to Student schema"
```

---

### Task 3: Thread `last_payment_date` through `appendStudent` and `updateStudent`

**Files:**
- Modify: `src/lib/sheets/students.ts`

- [ ] **Step 1: Accept and insert the field in `appendStudent`**

Find:
```ts
export async function appendStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    college_name: input.college_name ?? "",
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    active: true,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
```
Replace with:
```ts
export async function appendStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
  last_payment_date?: string | null;
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    college_name: input.college_name ?? "",
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    last_payment_date: input.last_payment_date ?? null,
    active: true,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
```

- [ ] **Step 2: Accept the field in `updateStudent`**

Find:
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
    active?: boolean;
  },
): Promise<void> {
  await db.from("students").update(input).eq("id", id);
  revalidateTag("students", { expire: 0 });
}
```
Replace with:
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

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/students.ts
git commit -m "feat(students): thread last_payment_date through append/update"
```

---

### Task 4: Accept `last_payment_date` in the students API routes

**Files:**
- Modify: `src/app/api/students/route.ts`
- Modify: `src/app/api/students/[id]/route.ts`

- [ ] **Step 1: Add it to the POST body schema**

In `src/app/api/students/route.ts`, find:
```ts
    const body = z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        college_name: z.string().optional(),
        subscription_type: z.string().optional(),
        general_notes: z.string().optional(),
        birth_date: z.string().nullable().optional(),
      })
      .parse(await req.json());
```
Replace with:
```ts
    const body = z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        college_name: z.string().optional(),
        subscription_type: z.string().optional(),
        general_notes: z.string().optional(),
        birth_date: z.string().nullable().optional(),
        last_payment_date: z.string().nullable().optional(),
      })
      .parse(await req.json());
```

- [ ] **Step 2: Add it to the PATCH body schema**

In `src/app/api/students/[id]/route.ts`, find:
```ts
const PatchBody = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  college_name: z.string().optional(),
  subscription_type: z.string().optional(),
  general_notes: z.string().optional(),
  birth_date: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
```
Replace with:
```ts
const PatchBody = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  college_name: z.string().optional(),
  subscription_type: z.string().optional(),
  general_notes: z.string().optional(),
  birth_date: z.string().nullable().optional(),
  last_payment_date: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/students/route.ts "src/app/api/students/[id]/route.ts"
git commit -m "feat(api): accept last_payment_date on student create/update"
```

---

### Task 5: Add the field to the add-student dialog

**Files:**
- Modify: `src/components/forms/add-student-dialog.tsx`

- [ ] **Step 1: Add state for the new field**

Find:
```tsx
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
```
Replace with:
```tsx
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [lastPaymentDate, setLastPaymentDate] = useState("");
```

- [ ] **Step 2: Reset it alongside the other fields**

Find:
```tsx
  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setCollegeName("__none__");
    setSubscriptionType("");
    setNotes("");
    setBirthDate("");
  };
```
Replace with:
```tsx
  const reset = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setCollegeName("__none__");
    setSubscriptionType("");
    setNotes("");
    setBirthDate("");
    setLastPaymentDate("");
  };
```

- [ ] **Step 3: Include it in the POST body**

Find:
```tsx
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType,
          general_notes: notes,
          birth_date: birthDate || null,
        }),
```
Replace with:
```tsx
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType,
          general_notes: notes,
          birth_date: birthDate || null,
          last_payment_date: lastPaymentDate || null,
        }),
```

- [ ] **Step 4: Render the input, right after "תאריך לידה"**

Find:
```tsx
          <div>
            <Label>תאריך לידה</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>הערות כלליות</Label>
```
Replace with:
```tsx
          <div>
            <Label>תאריך לידה</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>תאריך תשלום אחרון</Label>
            <Input type="date" value={lastPaymentDate} onChange={(e) => setLastPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>הערות כלליות</Label>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/add-student-dialog.tsx
git commit -m "feat(students): add last-payment-date field to add-student dialog"
```

---

### Task 6: Add the field to the edit-student dialog

**Files:**
- Modify: `src/components/forms/edit-student-dialog.tsx`

- [ ] **Step 1: Add state, initialized from the student**

Find:
```tsx
  const [birthDate, setBirthDate] = useState(student.birth_date ?? "");
  const [active, setActive] = useState(student.active);
```
Replace with:
```tsx
  const [birthDate, setBirthDate] = useState(student.birth_date ?? "");
  const [lastPaymentDate, setLastPaymentDate] = useState(student.last_payment_date ?? "");
  const [active, setActive] = useState(student.active);
```

- [ ] **Step 2: Resync it when the dialog reopens**

Find:
```tsx
  useEffect(() => {
    if (open) {
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setPhone(student.phone);
      setEmail(student.email);
      setCollegeName(student.college_name || "__none__");
      setSubscriptionType(student.subscription_type);
      setNotes(student.general_notes);
      setBirthDate(student.birth_date ?? "");
      setActive(student.active);
    }
  }, [open, student]);
```
Replace with:
```tsx
  useEffect(() => {
    if (open) {
      setFirstName(student.first_name);
      setLastName(student.last_name);
      setPhone(student.phone);
      setEmail(student.email);
      setCollegeName(student.college_name || "__none__");
      setSubscriptionType(student.subscription_type);
      setNotes(student.general_notes);
      setBirthDate(student.birth_date ?? "");
      setLastPaymentDate(student.last_payment_date ?? "");
      setActive(student.active);
    }
  }, [open, student]);
```

- [ ] **Step 3: Include it in the PATCH body**

Find:
```tsx
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          college_name: collegeName === "__none__" ? "" : collegeName,
          subscription_type: subscriptionType.trim(),
          general_notes: notes.trim(),
          birth_date: birthDate || null,
          active,
        }),
```
Replace with:
```tsx
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
```

- [ ] **Step 4: Render the input, right after "תאריך לידה"**

Find:
```tsx
          <div>
            <Label>תאריך לידה</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>הערות כלליות</Label>
```
Replace with:
```tsx
          <div>
            <Label>תאריך לידה</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>תאריך תשלום אחרון</Label>
            <Input type="date" value={lastPaymentDate} onChange={(e) => setLastPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>הערות כלליות</Label>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/edit-student-dialog.tsx
git commit -m "feat(students): add last-payment-date field to edit-student dialog"
```

---

### Task 7: Compute the `paymentDue` alert in `/api/admin/stats`

**Files:**
- Modify: `src/app/api/admin/stats/route.ts`

- [ ] **Step 1: Add the `PaymentDueStudent` type and extend `AdminStats`**

Find:
```ts
export type AbsentStudent = { id: string; name: string };

export type AdminStats = {
  today: string;
  students: { total: number; active: number };
  coaches: { total: number; active: number };
  groups: number;
  weekSessionCount: number;
  todaySessions: Session[];
  upcomingSessions: Session[];
  coachMap: Record<string, string>;
  alerts: { noCoach: Session[]; absentStudents: AbsentStudent[] };
  sessionsByDay: DayBar[];
  sessionsByType: TypeSlice[];
  newMessages: number;
};
```
Replace with:
```ts
export type AbsentStudent = { id: string; name: string };
export type PaymentDueStudent = { id: string; name: string };

export type AdminStats = {
  today: string;
  students: { total: number; active: number };
  coaches: { total: number; active: number };
  groups: number;
  weekSessionCount: number;
  todaySessions: Session[];
  upcomingSessions: Session[];
  coachMap: Record<string, string>;
  alerts: { noCoach: Session[]; absentStudents: AbsentStudent[]; paymentDue: PaymentDueStudent[] };
  sessionsByDay: DayBar[];
  sessionsByType: TypeSlice[];
  newMessages: number;
};
```

- [ ] **Step 2: Compute the list and add it to the returned alerts**

Find:
```ts
    const past21 = format(addDays(parseISO(today), -21), "yyyy-MM-dd");
```
Replace with:
```ts
    const past21 = format(addDays(parseISO(today), -21), "yyyy-MM-dd");
    const paymentCutoff = format(addDays(parseISO(today), -30), "yyyy-MM-dd");
```

Find:
```ts
    const todaySessions = (todayRows.data ?? []) as Session[];
    const upcomingSessions = (upcomingRows.data ?? []) as Session[];
    const noCoachSessions = (noCoachRows.data ?? []) as Session[];
    const weekSessions = (weekRows.data ?? []) as Session[];
```
Replace with:
```ts
    const todaySessions = (todayRows.data ?? []) as Session[];
    const upcomingSessions = (upcomingRows.data ?? []) as Session[];
    const noCoachSessions = (noCoachRows.data ?? []) as Session[];
    const weekSessions = (weekRows.data ?? []) as Session[];

    const paymentDue: PaymentDueStudent[] = students
      .filter((s) => s.active && (!s.last_payment_date || s.last_payment_date < paymentCutoff))
      .map((s) => ({ id: s.id, name: [s.first_name, s.last_name].filter(Boolean).join(" ") }));
```

Find:
```ts
      alerts: { noCoach: noCoachSessions, absentStudents },
```
Replace with:
```ts
      alerts: { noCoach: noCoachSessions, absentStudents, paymentDue },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/stats/route.ts"
git commit -m "feat(admin): compute payment-due alert list in admin stats"
```

---

### Task 8: Render the "צריך לשלם" card on the admin dashboard

**Files:**
- Modify: `src/components/admin-dashboard.tsx`

- [ ] **Step 1: Add the `CircleDollarSign` icon import and the `PaymentDueStudent` type import**

Find:
```tsx
import {
  Users,
  User,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  Layers,
  MessageSquare,
  Send,
  Loader2,
  UserX,
} from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { AdminStats, AbsentStudent } from "@/app/api/admin/stats/route";
```
Replace with:
```tsx
import {
  Users,
  User,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  Layers,
  MessageSquare,
  Send,
  Loader2,
  UserX,
  CircleDollarSign,
} from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { AdminStats, AbsentStudent, PaymentDueStudent } from "@/app/api/admin/stats/route";
```

- [ ] **Step 2: Add the new card after the "לא הגיעו 3 שבועות" card**

Find:
```tsx
      {/* Alerts: absent students (3 weeks) */}
      {(isLoading || (data?.alerts.absentStudents.length ?? 0) > 0) && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserX size={14} className="text-rose-500" />
              לא הגיעו 3 שבועות
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-1.5">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.absentStudents.map((s) => <AbsentStudentRow key={s.id} student={s} />)
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```
Replace with:
```tsx
      {/* Alerts: absent students (3 weeks) */}
      {(isLoading || (data?.alerts.absentStudents.length ?? 0) > 0) && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserX size={14} className="text-rose-500" />
              לא הגיעו 3 שבועות
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-1.5">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.absentStudents.map((s) => <AbsentStudentRow key={s.id} student={s} />)
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts: payment due (30+ days since last payment) */}
      {(isLoading || (data?.alerts.paymentDue.length ?? 0) > 0) && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CircleDollarSign size={14} className="text-orange-500" />
              צריך לשלם
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-1.5">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.paymentDue.map((s) => <PaymentDueRow key={s.id} student={s} />)
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the `PaymentDueRow` sub-component next to `AbsentStudentRow`**

Find:
```tsx
function AbsentStudentRow({ student }: { student: AbsentStudent }) {
  return (
    <Link
      href={`/admin/students?highlight=${student.id}`}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-rose-50\50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <UserX size={13} className="text-rose-400 shrink-0" />
        <span className="text-sm">{student.name}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
  );
}
```
Replace with:
```tsx
function AbsentStudentRow({ student }: { student: AbsentStudent }) {
  return (
    <Link
      href={`/admin/students?highlight=${student.id}`}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-rose-50\50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <UserX size={13} className="text-rose-400 shrink-0" />
        <span className="text-sm">{student.name}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
  );
}

function PaymentDueRow({ student }: { student: PaymentDueStudent }) {
  return (
    <Link
      href={`/admin/students?highlight=${student.id}`}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/60 dark:hover:bg-orange-950/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <CircleDollarSign size={13} className="text-orange-400 shrink-0" />
        <span className="text-sm">{student.name}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-dashboard.tsx
git commit -m "feat(admin): add payment-due alert card to admin dashboard"
```

---

### Task 9: Full build and end-to-end check

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors. (Note: in a sandbox without real Supabase credentials in `.env.local`, this step may fail during "Collecting page data" with `supabaseUrl is required` — that's an environment limitation unrelated to this change, not a regression. If that happens here, rely on `npx tsc --noEmit` having passed on every task instead, and run the real `npm run build` wherever real credentials are configured before deploying.)

- [ ] **Step 2: End-to-end manual walkthrough**

Using `npm run dev` with real Supabase credentials:
1. Confirm the migration from Task 1 has been applied.
2. `/admin/students` → add a new student, leave "תאריך תשלום אחרון" empty → save.
3. `/admin` (dashboard) → confirm the new student appears under "צריך לשלם".
4. Edit that student, set "תאריך תשלום אחרון" to today → save → refresh the dashboard (wait for the 30s stats cache to expire, or hard-refresh) → confirm they no longer appear in the alert.
5. Edit another active student, set the date to 31+ days ago → confirm they appear in the alert; set it to 29 days ago → confirm they don't.
6. Set a student with an overdue payment date to inactive → confirm they drop out of the alert.
7. Click a row in the "צריך לשלם" card → confirm it navigates to `/admin/students?highlight=<id>`.
