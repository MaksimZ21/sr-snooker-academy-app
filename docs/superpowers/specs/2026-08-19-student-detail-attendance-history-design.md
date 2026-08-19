# Admin Student Detail — Inline Attendance History

Date: 2026-08-19

## Problem

The admin student detail page (`/admin/students/[id]`) shows only aggregate
attendance stats (present count, absent count, percentage). There's no way to
see *which* sessions those numbers come from — an admin looking at "100%,
4 נוכח" has no way to tell which 4 sessions that refers to, or to spot a
specific missed session, without leaving the page.

A near-identical breakdown already exists and is used elsewhere in the app
(`StudentHistoryDialog`, backed by `GET /api/students/[id]/sessions`) — it
just isn't wired into this particular screen.

## Scope

- **Admin only**: `/admin/students/[id]` (`src/app/(admin)/admin/students/[id]/page.tsx`).
  The coach-facing equivalent (`/coach/students/[id]`) is unchanged.
- Reuses the existing data (attendance rows with a marked status, joined to
  their session) — no new attendance logic, no change to how the 3 stat
  cards are computed.

## Implementation

### API: `src/app/api/admin/students/[id]/route.ts`

Add an `attendance_detail` array to the response, alongside the existing
`attendance_summary`. Computed the same way `GET /api/students/[id]/sessions`
already does it (fetch sessions by the IDs referenced in the student's
attendance rows, pair each with its status, sort newest-first) — inlined here
so the detail page gets everything in its one existing request instead of
firing a second network call:

```ts
type AttendanceDetailRow = { session: Session; attendance_status: Attendance["status"] };
```

Sort order: `date` desc, then `start_time` desc (same as the existing
`/api/students/[id]/sessions` route).

### Page: `src/app/(admin)/admin/students/[id]/page.tsx`

New section, "היסטוריית אימונים", inserted directly below the 3-stat-card
grid and above the "קבוצות" section. For each row: date, time range, and a
status badge (נוכח / לא נוכח / איחור) — same labels, badge variants, and date
formatting already used in `StudentHistoryDialog`, just rendered inline in
the page instead of inside a `Dialog`. Empty state ("אין עדיין אימונים עם
נוכחות מסומנת") matches the page's existing empty-state style (e.g. the
"הערות מאימונים" section's dashed-border empty box).

## Out of Scope

- No change to `/coach/students/[id]`.
- No change to how attendance is marked or to the stat-card calculation.
- No pagination/collapsing for students with a long history — YAGNI until
  it's actually a problem.
