# Students/Players Split + Player Activation — Design

## Problem

Tournament-only customers (`is_tournament_only: true`) are created with `active: false` so they're excluded from group/session pickers. But `/admin/students` never actually filters them out (that part of the original tournaments spec was never implemented) — they show up mixed into the regular student list, indistinguishable from a genuinely churned real student, both just labeled "לא פעיל".

Separately, a real coached student who has also played a tournament has no obvious way for the admin to make that connection from their student profile, and a real student who has NOT yet played a tournament has no way for the admin to proactively set them up as a player ahead of any specific tournament.

## Decisions (confirmed with the user)

1. **`/admin/students` gets two tabs**: "מתאמנים" (regular students, `is_tournament_only !== true` — today's existing list, filters unchanged) and "שחקנים" (`is_tournament_only === true`).
2. **`active` stays `false` in the database** for tournament-only customers — unchanged, still relied on elsewhere to exclude them from pickers. Only the *display* changes: the "לא פעיל" badge is suppressed on rows in the "שחקנים" tab (it's misleading there — inactive-as-a-student isn't a meaningful concept for a tournament-only customer).
3. **New action on a real student's detail page** (`/admin/students/[id]`): for a student who is not `is_tournament_only` and has no `public_slug` yet, a button "פתח לו את אזור הטורנירים" generates them a `public_slug` (i.e. makes them a "player," the same as happens automatically the first time someone is added to a tournament) — purely additive, touches nothing else on the student record (`active`, `is_tournament_only`, etc. are untouched). Confirmed explicitly: **not a navigation link** — clicking it doesn't take the admin anywhere; it just flips the capability on for that student. Once a student has a `public_slug` (via this button or via actually having played a tournament), show a small informational indicator instead of the button — also not a link.

## Architecture

- **`src/lib/sheets/players.ts`** gains `ensurePlayerSlug(studentId: string): Promise<void>` — extracted from the existing lazy-slug-generation logic already in `addTournamentParticipant` (`src/lib/sheets/tournaments.ts`), which is refactored to call it instead of duplicating the logic. Same idempotent guard: only writes if `public_slug` is currently `null` (`.is("public_slug", null)` on the update), safe against a race with a near-simultaneous tournament add.
- **`POST /api/admin/students/[id]/activate-player`** (new route, admin-only) — calls `ensurePlayerSlug`.
- **`src/components/students-list.tsx`** — wrapped in a `Tabs` (`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, matching the pattern already used in `admin-messages.tsx`). Existing filter/search/list logic is reused for the "מתאמנים" tab unchanged; the "שחקנים" tab reuses the same row rendering with the "לא פעיל" badge suppressed via a new prop.
- **`src/app/(admin)/admin/students/[id]/page.tsx`** — new button/indicator in the header pills row, driven by a new mutation calling the activate-player route.

## Out of scope

- Phase 6 (a tournaments area a student can see when they log into their own account) — this button does not create or reveal any such area; it only creates the `public_slug` that a future personal area would eventually key off of. No change to `STUDENT_NAV` or any student-facing route.
- No change to how tournament-only customers are created or to the search-or-create flow in the tournament participant picker.
