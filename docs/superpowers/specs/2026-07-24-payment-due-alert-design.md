# Payment-Due Alert on Admin Dashboard — Design

Date: 2026-07-24

## Background

The academy needs a way for the admin to know when a student is overdue on payment — specifically, more than a month has passed since they last paid. Payment itself is handled entirely outside this app (in person, via the external CRM, etc.) — this feature does not process or record actual payments, only tracks the *date* of the last known payment so a staleness alert can be computed from it.

Investigated the existing payment-related code before designing this:
- `students.subscription_type` is a free-text label (e.g. "monthly") with no date attached — not usable for this.
- `sessions.payment_status` (paid/pending) tracks whether a **coach** was paid for a session (used only on the salary/finance pages) — unrelated to student-to-academy payment.
- The CRM webhook (`src/app/api/webhooks/crm/route.ts`, `upsertStudentFromCrm`) does not send any payment or billing date field.
- **Conclusion: there is currently no field anywhere that records when a student last paid.** This design adds one.

The existing admin dashboard already has an analogous staleness alert — "לא הגיעו 3 שבועות" (students who haven't attended in 3 weeks), computed in `/api/admin/stats` and rendered as a dashboard card (`admin-dashboard.tsx`, `AbsentStudentRow`). This design follows that exact pattern for consistency.

## Scope

1. New `last_payment_date` column on `students`, manually editable by the admin.
2. Add/edit-student dialogs get a new date field for it.
3. `/api/admin/stats` computes a `paymentDue` alert list: active students where `last_payment_date` is null or more than 30 days old.
4. New dashboard card, styled like the existing "לא הגיעו 3 שבועות" card, listing those students.

Explicitly out of scope: any actual payment processing, any automatic sync from the CRM (no payment data available there), a badge on the student row in `/admin/students`, different thresholds per `subscription_type` (every active student uses the same flat 30-day rule), any notification/push beyond the dashboard card.

## 1. Data model

**New migration** `supabase/migrations/20260724_students_last_payment_date.sql`:
```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_payment_date date;
```
Nullable, no default — existing students start with no recorded payment date, which is intentional: per the product decision, a student with no payment date on file shows up in the alert immediately (same treatment as one whose last payment was over 30 days ago), since "no record" and "overdue" both mean the admin needs to check.

**`src/lib/sheets/schemas.ts` — `StudentRow`**: add `last_payment_date: z.string().nullable().default(null)` (same shape as the existing `birth_date` field on this schema).

## 2. Editing

**`src/components/forms/add-student-dialog.tsx`**: new state `lastPaymentDate` (string, empty by default), rendered as a `<Label>תאריך תשלום אחרון</Label>` + `<Input type="date">` — placed directly after the existing "תאריך לידה" field, same pattern. Included in the POST body as `last_payment_date: lastPaymentDate || null`.

**`src/components/forms/edit-student-dialog.tsx`**: same field, initialized from `student.last_payment_date ?? ""`, reset in the same `useEffect` that resyncs the other fields when the dialog reopens, included in the PATCH body as `last_payment_date: lastPaymentDate || null`.

**`src/lib/sheets/students.ts` — `appendStudent`**: accept `last_payment_date?: string | null` in its input type, pass through to the insert (`last_payment_date: input.last_payment_date ?? null`).

**`src/app/api/students/route.ts` (POST) and `src/app/api/students/[id]/route.ts` (PATCH)**: add `last_payment_date: z.string().nullable().optional()` to each route's zod body schema, matching how `birth_date` is already handled there.

**`src/lib/sheets/students.ts` — `updateStudent`**: already takes a loosely-typed update object per the existing PATCH route pattern — no change needed beyond the type accepting the new field (it already spreads whatever fields are passed through to `db.from("students").update(...)`, same as `birth_date`).

## 3. Alert computation

**`src/app/api/admin/stats/route.ts`**:
- Add `PaymentDueStudent = { id: string; name: string }` type (mirrors `AbsentStudent`).
- Add `paymentDue: PaymentDueStudent[]` to the `AdminStats["alerts"]` type.
- Inside `fetchAdminStatsData`, alongside the existing `past21` cutoff, add:
  ```ts
  const paymentCutoff = format(addDays(parseISO(today), -30), "yyyy-MM-dd");
  ```
- Compute the list from the already-fetched `students` array (no extra query needed — `fetchStudents()` already returns `last_payment_date` once it's added to `StudentRow`):
  ```ts
  const paymentDue: PaymentDueStudent[] = students
    .filter((s) => s.active && (!s.last_payment_date || s.last_payment_date < paymentCutoff))
    .map((s) => ({ id: s.id, name: [s.first_name, s.last_name].filter(Boolean).join(" ") }));
  ```
- Add `paymentDue` to the returned `alerts` object.

## 4. Dashboard card

**`src/components/admin-dashboard.tsx`**: new card placed after the existing "לא הגיעו 3 שבועות" card, following the exact same conditional-render / skeleton / row-list structure:
```tsx
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
```
New `PaymentDueRow` sub-component, copied from `AbsentStudentRow` with the icon/color swapped to orange and the same `/admin/students?highlight=${student.id}` link target:
```tsx
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
`PaymentDueStudent` type imported from the stats route (same as `AbsentStudent` is today). `CircleDollarSign` added to the existing `lucide-react` import in this file.

## Error handling

No new failure modes beyond what the existing patterns already handle — `last_payment_date` is optional/nullable end-to-end (DB column, zod schemas, dialog state), so omitting it never breaks a create/update. The stats query needs no new DB round-trip (reuses `fetchStudents()`, already fetched for other stats), so no new failure surface there either.

## Testing

- Manual: run the migration in Supabase SQL Editor, confirm `last_payment_date` column exists on `students`.
- Manual: add a new student without setting a payment date → appears in "צריך לשלם" on the dashboard.
- Manual: edit an existing student, set `last_payment_date` to today → disappears from the alert (after the 30s stats cache expires, or after a hard refresh).
- Manual: edit a student's `last_payment_date` to 31+ days ago → appears in the alert; set to 29 days ago → does not appear.
- Manual: set a student to inactive → confirm they drop out of the alert regardless of payment date (matches the existing `active` filter used by `absentStudents`).
- Manual: click a row in the new card → lands on `/admin/students?highlight=<id>`, same as the existing absent-students card.
