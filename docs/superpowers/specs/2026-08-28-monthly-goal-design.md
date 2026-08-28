# Monthly Personal Goal — Design Spec

Date: 2026-08-28

## Purpose

Starting this month, every student picks one personal improvement goal for
the coming month, from four fixed categories. In every training session
that month, the coach spends ~10-15 minutes on a drill matching that
category and records a number. The student can see their progress as a
chart in their personal area at any time during (and after) the month.

This already exists as a manual process for college-program students (via
an external Google Form). This spec brings the same idea into the app,
available to any student.

## Categories

Fixed, not admin-configurable (matches the four options already in use):

| Category | Hebrew label | What the coach records each session |
|---|---|---|
| `technique` | טכניקה - שיפור כניסה למכה ו/או הוצאת המכה | X מתוך Y ניסיונות הצליחו |
| `angle` | זווית - שיפור אחוז ההצלחה בהכנסת כדורים ממרחקים קצרים | X מתוך Y ניסיונות הצליחו |
| `cue_ball_control` | שליטה בלבן - שיפור הדיוק בשליטה בלבן בנוסף להכנסת כדורים | X מתוך Y ניסיונות הצליחו |
| `breaks` | ברייקים - שיפור הרצף האישי שלי | הרצף הגבוה ביותר שהושג באימון (מספר בודד) |

The first three categories share one input format (success count out of
attempt count); `breaks` uses a single number (that session's best run).

## Data Model

Two new Supabase tables, following existing conventions (RLS enabled, no
policies — service role only; accessed only through a new
`src/lib/sheets/monthly-goals.ts` module).

### `student_monthly_goals`

| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| student_id | text, FK to `students.id` | |
| month | text | `YYYY-MM`, e.g. `"2026-09"` |
| category | text | one of `technique` / `angle` / `cue_ball_control` / `breaks` |
| created_at | timestamptz, default now() | |

Unique on `(student_id, month)` — one goal per student per month. A student
who hasn't picked yet for the current month simply has no row; there's no
default and no carry-over from last month (picking again, even the same
category, is a deliberate action every month).

### `student_goal_entries`

| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| goal_id | uuid, FK to `student_monthly_goals`, `ON DELETE CASCADE` | |
| session_id | text, FK to `sessions.id` | which session this number was recorded in |
| success_count | int, nullable | used when the goal's category is `technique` / `angle` / `cue_ball_control` |
| attempt_count | int, nullable | same three categories |
| best_break | int, nullable | used when the goal's category is `breaks` |
| created_at | timestamptz, default now() | |

Unique on `(goal_id, session_id)` — re-opening the same session's goal tab
and saving again updates that session's single entry, never creates a
duplicate. Only the fields matching the goal's category are ever non-null;
the other field(s) stay null (enforced at the application layer, not a DB
constraint — matches this codebase's existing convention of keeping
constraints simple and validation in the API route).

## Student-Facing UI

### Personal area (new page, new nav item)

- New "המטרה שלי" item in `STUDENT_NAV`, linking to a new
  `/student/goal` page.
- **No goal picked yet for the current calendar month:** shows the four
  categories exactly as radio-style choices (label + description from the
  table above), a single confirm action. Once picked, it's saved — no
  "change my mind" edit path in this iteration (see Out of Scope).
- **Goal already picked for the current month:** shows the chosen category
  name, and a line chart (reusing this codebase's existing lazy-loaded
  Recharts pattern, e.g. `coach-charts.tsx`/`admin-charts.tsx`) plotting
  this month's entries in session order:
  - For the three X/Y categories: Y axis is the success percentage
    (`success_count / attempt_count * 100`) per session.
  - For `breaks`: Y axis is `best_break` per session.
  - No entries yet this month: chart area shows "עדיין אין נתונים החודש"
    instead of an empty chart.
- **Past months:** a simple collapsed list below the current month, one row
  per past `student_monthly_goals` row (category + month), each expandable
  to show that month's same chart, read-only. A month with a goal but zero
  entries just shows the empty-state message.

## Coach-Facing UI

### Session detail page (`src/components/session-detail.tsx`)

Currently two tabs: "נוכחות" (attendance), "הערות" (notes). Add a third:

- **"מטרה"** — one row per student in the session (same student list the
  other two tabs already use), matching each student against
  `student_monthly_goals` for the session's month (derived from
  `session.date`):
  - **Student has a goal this month:** show the category name and the
    matching input(s) — two small number fields (הצליחו / ניסיונות) for
    the three X/Y categories, or one number field (הרצף הגבוה ביותר) for
    `breaks` — pre-filled if an entry already exists for this session, with
    a save button. Saving upserts the `student_goal_entries` row for
    `(goal_id, session_id)`.
  - **Student has no goal this month:** a plain, non-interactive line:
    "לא נבחרה מטרה החודש".
  - Same `readOnly` prop pattern as the existing `AttendancePanel`/
    `NotesPanel` — read-only for anyone without edit rights on this
    session, matching the page's existing `canEditAttendance`/
    `canEditNotes` convention (this tab follows `canEditAttendance`, since
    it's filled during the same live session).

### Student detail pages (admin + coach, existing)

The same read-only chart used in the student's own personal area also
renders on `/admin/students/[id]` and `/coach/students/[id]` (both already
show notes/assessments for a student) — showing the student's current
month's goal + chart if they have one, nothing if they don't. This is how
staff can see progress without needing the student to share anything.

## API

New routes, all under `src/lib/sheets/monthly-goals.ts` for data access:

- `GET /api/students/[id]/monthly-goal` — the student's own current-month
  goal + all past months' goals + entries for each (used by both the
  student's personal page and the staff-facing student detail pages).
  Reachable by: the student themselves (own id only), or admin/coach.
- `POST /api/students/[id]/monthly-goal` — create this month's goal
  (`{ category }`). Reachable by: the student themselves only (this is a
  self-service pick, not something staff do on their behalf, per the
  approved design). Fails if a goal already exists for the current month
  (no overwrite).
- `PUT /api/sessions/[id]/goal-entries/[studentId]` — upsert one session's
  entry for one student (`{ successCount, attemptCount }` or
  `{ bestBreak }`, matching the student's active goal's category — the
  route looks up the category server-side and validates the right fields
  were sent). Reachable by: admin, or the session's coach (matching
  `canEditAttendance`'s existing authorization for this same session).

## Out of Scope (YAGNI)

- No editing/changing a goal once picked for the month — if a student picks
  the wrong category, it stays until next month (staff can still see it's
  "wrong" via the chart and just talk to them; no admin override UI in V1).
- No automatic month-end summary or WhatsApp message — the chart is simply
  always viewable in the app; if the academy wants to actually message a
  student their progress, that's a manual "screenshot and send" or a
  separate future feature, not built here.
- No computed single "improvement %" number — a chart of the raw values
  over the month is the whole "sharing the improvement metric" feature,
  per explicit product decision.
- No admin control over the four categories (adding/renaming/removing) —
  they're a fixed, hardcoded list matching the existing external process.
- No goal for a student who has no scheduled sessions that month — the tab
  simply never shows a row for them since the coach-facing UI is
  session-scoped; the student can still pick a goal and see an empty chart.
- No reminder/nudge if a student hasn't picked a goal yet this month.
