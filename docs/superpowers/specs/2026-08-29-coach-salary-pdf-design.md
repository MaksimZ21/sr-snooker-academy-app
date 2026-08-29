# Coach Monthly Salary PDF — Design Spec

Date: 2026-08-29

## Purpose

Admins already see a full monthly salary breakdown per coach on `/admin/salary`
(sessions, prices, offsets, net total), with CSV export and an existing
WhatsApp **text** monthly-report cron. This adds a way for an admin to
generate a **PDF** version of one coach's report for the currently-selected
month and send it straight to that coach's own WhatsApp number, on demand.

## Scope

- Lives entirely inside the existing `/admin/salary` page (`SalaryView`) —
  no new page.
- Only available when the page is in "month" view mode (not "year" or "all
  time") — the report is always for one specific calendar month.
- One button per coach row, inside the row's existing expanded section (next
  to the offsets area): "הפקת ושליחת PDF למאמן". Clicking it does the whole
  flow in one step — generate, then send — with a loading state and a toast
  on success/failure. No separate download option and no public/shareable
  link — this is an admin-triggered, one-shot server-side action.
- The PDF is sent to the coach's own phone number on file (`coaches.phone`),
  the same number the existing text monthly-report cron already messages.
- If the coach has no phone number on file, or has no sessions in the
  selected month, the button surfaces a clear error toast and sends nothing.

## PDF Content

One A4 page per coach/month, styled consistently with the existing
assessment PDF (Heebo font, green academy palette, RTL layout):

- Header: coach name, "דוח שכר", the period label (e.g. "אוגוסט 2026").
- A table of that month's sessions: date, time, training type, price —
  sorted chronologically.
- A list of that month's offsets (קיזוזים), if any: description + amount.
- A totals box: session count, gross income, offsets (if any), and the net
  total ("לתשלום") — the same figures already shown in the app and in the
  existing WhatsApp text report.

## Mechanism

- New `src/lib/sheets/salary.ts`: `fetchCoachSalaryForMonth(email, month)`
  — a single-coach, single-month query (sessions + offsets), reusing the
  existing `CoachSalary`/`SessionDetail`/`OffsetEntry` types already defined
  in `src/app/api/admin/salary/route.ts` (imported type-only, matching how
  `salary-view.tsx` already consumes those types today — no duplicate type
  definitions).
- `SessionDetail` gains a `start_time` field (currently missing — needed to
  show "שעה" per session) and the existing salary route's query/mapping is
  extended to populate it. Purely additive; no existing behavior changes.
- New `src/components/salary-pdf.tsx`: `SalaryPdfDocument`, a `@react-pdf/renderer`
  component built the same way as `assessment-pdf.tsx`.
- New `POST /api/admin/salary/[email]/send-pdf` (admin-only): looks up the
  coach's name/phone, calls `fetchCoachSalaryForMonth`, renders the PDF to a
  buffer, and sends it via the existing `sendWhatsAppFileByUpload` (already
  used by the general WhatsApp send route) — same mechanism, no new Green
  API surface needed.
- `SalaryView`/`CoachRow` get the new button, visible only in month mode,
  wired to the new route with a loading + toast UX consistent with the
  rest of the app (e.g. `assessment-send-menu.tsx`).

## Out of Scope (YAGNI)

- No bulk "send to all coaches" action — one coach at a time, admin-picked,
  matching what was asked for. The existing text-based monthly cron already
  covers the "everyone, automatically" case.
- No download-only option — WhatsApp send only, per product decision.
- No public/shareable link for this PDF (unlike the assessment PDF) — it
  always contains one specific coach's private financial data, so no token
  or public URL surface is introduced for it.
- No PDF for "year" or "all time" views — month only.
