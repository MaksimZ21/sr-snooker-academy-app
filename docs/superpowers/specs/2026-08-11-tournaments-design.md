# Tournaments Area — Design Spec

Date: 2026-08-11 (revised 2026-08-25: players, ratings, handicap, public player profiles)

## Purpose

The academy runs snooker tournaments — mostly internal (students competing against
each other), sometimes external (open to non-students too). Today there is no
tooling for this at all: rosters, group ("house") draws, standings, and knockout
brackets are all managed by hand outside the app.

This feature adds a tournaments area where:
- An admin creates a tournament and assigns one coach as its manager.
- That manager runs the tournament end-to-end inside the app: participants,
  house draw, house-stage results, knockout bracket, payment tracking.
- Anyone with a shared link — including people with no account in the app
  (external participants, parents, etc.) — can view live standings and the
  bracket, without logging in.
- Every participant is a persistent "player" identity (backed by the existing
  `students` table — see below), tracked with a rating that updates
  automatically from match results and carries over between tournaments, and
  gets their own shareable public profile page.

## Roles & Permissions

| Who | Can do |
|---|---|
| Admin | Create tournaments, assign/change the manager, everything a manager can do (admin is a superuser throughout this app), view all tournaments, manage the global player list |
| Assigned tournament manager (a coach) | Add/edit participants, mark who paid, run the house draw, enter house match results, build and play the knockout bracket, mark the tournament as finished |
| Other logged-in coaches | View-only — see the tournament in `/coach/tournaments`, no edit controls |
| Anyone with a public link (`/t/[slug]` for a tournament, `/p/[slug]` for a player) | View-only. No login required |

Only the assigned manager (plus admin) can edit a given tournament — not "any
coach," per explicit product decision.

## Data Model

New Supabase tables, following existing conventions (RLS enabled, accessed only
through a new `src/lib/sheets/tournaments.ts` module — never queried directly
from components/pages).

### `tournaments`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| manager_email | text | FK-ish to coaches.email (untyped client, no enforced FK needed to match existing patterns, but validate against active coaches in the API route) |
| rules_url | text, nullable | link to a document (e.g. Google Drive) with the tournament's rules |
| completed | boolean, default false | manager/admin marks the tournament finished; moves it to "past tournaments" in the list view. Does not lock editing — just a display filter |
| public_slug | text, unique | short random slug generated on creation, used for `/t/[slug]` |
| handicap_points_per_rating_gap | int, default 20 | admin-editable per tournament (see "Rating & Handicap" below); how many rating points of difference equal 1 handicap point |
| created_at | timestamptz, default now() | |

### `tournament_participants`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | uuid, FK | |
| student_id | text, FK to `students.id` | see "Players" below — every participant is a `students` row, not free-typed text |
| paid | boolean, default false | editable by admin + manager only; never shown on the public page |
| house_id | uuid, nullable, FK to tournament_houses | null until the draw runs |
| created_at | timestamptz, default now() | |

### `tournament_houses`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | uuid, FK | |
| label | text | e.g. "בית 1" |

### `tournament_house_matches`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| house_id | uuid, FK | |
| participant_a_id | uuid, FK | |
| participant_b_id | uuid, FK | |
| frames_a | int, nullable | null = not yet played |
| frames_b | int, nullable | |

Generated automatically (every pairing within the house, i.e. round-robin) the
moment the draw runs or a participant is moved into/out of a house manually.

### `tournament_knockout_matches`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | uuid, FK | |
| round | int | 1 = first round |
| slot | int | position within the round, used to compute bracket layout |
| participant_a_id | uuid, nullable, FK | manually placed by the manager |
| participant_b_id | uuid, nullable, FK | |
| frames_a | int, nullable | |
| frames_b | int, nullable | |
| next_match_id | uuid, nullable, FK (self) | where the winner of this match advances to |

### `students` table (existing — extended, not replaced)

Tournament participants are **not** a separate "players" table — they're the
same `students` table already used throughout the app, broadened to also
represent "customers" who've never taken a lesson. This is deliberate: it
means a tournament player is automatically eligible for the loyalty program
(`docs/superpowers/specs/2026-08-24-loyalty-program-design.md`) with zero
extra work, and the admin can send them a login invite at any time using the
exact same existing flow used for real students, if they ever want one.

New columns:

| column | type | notes |
|---|---|---|
| is_tournament_only | boolean, default false | true for a "customer" created purely through tournament registration, who has never been a coached student. Used to filter them **out** of the regular `/admin/students` list and every group/session student picker, so they don't clutter academy-facing screens |
| rating | int, default 1000 | see "Rating System" below. Only meaningful once the student has played at least one tournament match; a fresh 1000 for anyone new |
| public_slug | text, nullable, unique | powers `/p/[slug]` (see "Public Player Profile"). `null` until the student is added to a tournament for the first time — generated lazily at that point, once, and reused for every subsequent tournament. A student who never plays a tournament never gets one, so they can never be looked up this way |

## Players — Registration & Reuse

Adding a participant to a tournament is a search-or-create flow against the
`students` table, not free-text entry:

1. The manager/admin starts typing a name into an autocomplete field.
2. It searches all existing `students` rows (both real academy students and
   past tournament-only customers) by name and phone.
3. **Found:** select the existing row — their rating and tournament history
   carry over automatically, no duplicate created.
4. **Not found:** the typed text becomes a brand-new `students` row:
   `first_name` = the typed text as-is (no first/last name splitting),
   `last_name` = `""`, `active = false`, `is_tournament_only = true`,
   `rating = 1000`. If this is the student's first-ever tournament
   (regardless of whether they're a real student or a new tournament-only
   row), a `public_slug` is generated for them at this point too.
5. A `tournament_participants` row is created linking `tournament_id` to the
   resolved `student_id`.

Because names can collide (two different people named "יוסי כהן"), the
autocomplete shows phone number alongside name where available, to help
disambiguate. This is a known, accepted limitation for the rare case where
two same-named people have no phone on file — not blocking for V1.

## Rating System (ELO)

- Every student effectively starts at rating 1000 (the column default) —
  this only becomes visible/meaningful once they've played a tournament
  match.
- After a result is saved for **any** match — a house round-robin match or a
  knockout match — both participants' `students.rating` update immediately,
  using the standard ELO formula:
  - Expected score for player A: `E_A = 1 / (1 + 10^((R_B - R_A) / 400))`
  - Actual score: `S_A = 1` if A won more frames than B, else `0` (frame
    margin doesn't matter beyond who won — matches this app's existing
    "frames_a vs frames_b determines the winner" convention)
  - New rating: `R_A' = R_A + K * (S_A - E_A)`, rounded to the nearest
    integer, with a fixed `K = 32` (not admin-configurable in V1 — a single
    reasonable constant, matching the standard chess-rating default; can
    become configurable later if it ever needs tuning)
- This applies symmetrically to both players every time a result is entered
  or corrected (re-entering a result recalculates from the two participants'
  ratings **at the time of that save** — no retroactive recalculation of
  every match ever played; see "Out of Scope" for why).

## Handicap ("פור") Display

- Purely informational — the app never applies it to a score. Players are
  expected to account for it themselves while playing, the same way this
  club already does today without the app (per explicit product decision).
- Wherever two players are paired — a house round-robin fixture, a knockout
  bracket slot — the app shows the computed handicap for that specific
  pairing: `round(abs(rating_a - rating_b) / handicap_points_per_rating_gap)`,
  phrased as e.g. "X נותן ל-Y __ נקודות" (the higher-rated player gives the
  points).
- `handicap_points_per_rating_gap` is set per tournament (default 20) by the
  admin/manager when creating or editing the tournament — a club's handicap
  convention is the kind of thing that's reasonable to want to tune, so it's
  a field, not a hardcoded constant.

## Public Player Profile

### `/p/[slug]`

Same shape as the existing tournament public page: outside the
`(admin)`/`(coach)`/`(student)` route groups, no authentication, reachable
only by someone who has the exact link (the slug is random and never listed
anywhere discoverable).

Shows only:
- Name
- Current rating
- List of tournaments the student has participated in (name, date, whether
  it's completed), each linking to that tournament's own public page
  (`/t/[slug]`)

Never shows phone, email, or any other field from the `students` row.

**Discovery path:** every participant name rendered on a tournament's public
page (`/t/[slug]` — in house tables and the knockout bracket) becomes a link
to that player's `/p/[slug]`, so a player is naturally reachable from a
tournament they're part of without anyone needing to separately hand out
their personal link. The admin/manager can also share a player's link
directly (e.g. via WhatsApp) if they want to.

## Admin UI: Players List

### `/admin/players` (new page, new "שחקנים" item in `ADMIN_NAV`)

A global list of every `students` row that has participated in at least one
tournament (`public_slug IS NOT NULL`) — spanning both real academy students
and `is_tournament_only` customers, since from a tournament standpoint
they're the same kind of entity. For each: name, phone (if any), current
rating, number of tournaments played, a copyable link to their public
profile, and a "דרגת נאמנות" assignment control (same as the loyalty
program's student-edit-dialog field — surfaced here too, since
`is_tournament_only` customers don't appear in the regular student list
where that control normally lives).

This is the primary place to manage tournament-only customers day to day,
since they're deliberately excluded from `/admin/students`.

## Tournament Draw (House Stage Setup)

1. Manager (or admin) enters the desired **number of houses** for the current
   participant list.
2. House size is derived automatically: `total participants ÷ number of
   houses`, with the remainder distributed one-per-house across the first N
   houses (e.g. 14 participants / 4 houses → two houses of 4, two of 3).
3. On confirm, the app performs a random shuffle (Fisher–Yates) of the full
   participant list and assigns participants to houses sequentially in
   shuffled order.
4. All round-robin house matches are generated immediately after assignment
   (empty results).
5. The manager can manually drag/move a participant to a different house
   afterward (e.g. to split friends/relatives) — this regenerates that
   participant's house_matches rows for both the old and new house.
6. "Re-draw" is available at any time. If no result has been entered anywhere
   in the tournament yet, it re-shuffles immediately. If any house match
   already has a result, re-drawing requires an explicit confirmation dialog
   (it deletes existing house match data — see "Out of Scope" for how this
   interacts with ratings already applied from those results).

## House Stage — Results & Standings

- Each house shows its list of round-robin matches. Each unplayed match has an
  "enter result" action taking a frame score for each side (e.g. 3–1);
  saving computes the winner **and triggers the ELO rating update** for both
  participants (see "Rating System").
- Each house shows a standings table, recalculated from entered results, with
  columns: **place, name, wins, frames won, frames lost**.
- Ranking order (tie-break rules): wins (desc) → frame difference, i.e.
  frames won − frames lost (desc) → frames won (desc).
- Unplayed matches don't count as 0–0 in the table — they're simply excluded
  from computation so mid-stage standings aren't skewed.
- An "all houses" overview screen shows every house's table side by side —
  this is also what renders on the public page. Each pairing (played or not)
  shows the computed handicap for that matchup.

## Knockout Stage

Deliberately fully manual — no automatic seeding from house results.

1. Manager picks a bracket size (must be a power of 2 — 4/8/16/32 slots).
2. For each round-1 slot, the manager manually assigns any participant from
   the tournament (not restricted to house winners). An empty slot is a bye
   (auto-advance).
3. Results are entered the same way as house matches (frame score per side),
   also triggering the ELO update for that pairing.
4. The moment a match's winner is determined, they're automatically written
   into the linked `next_match_id` slot for the following round — no manual
   double entry.
5. Rendered as a standard bracket tree, round 1 through the final, showing
   name + score for played matches and "TBD" for future ones. Each slot with
   two known participants shows their computed handicap.
6. Also part of the public page (view-only).

## Navigation & Pages

- **`/admin/tournaments`** (new nav item "טורנירים" in `ADMIN_NAV`) — list of
  all tournaments (active first, then completed), "טורניר חדש" button opens a
  create form: name, manager (select from active coaches), rules URL
  (optional), handicap points-per-rating-gap (optional, defaults to 20). On
  save, a `public_slug` is generated and the shareable link is shown for
  copying.
- **`/admin/tournaments/[id]`** and **`/coach/tournaments/[id]`** (new nav item
  "טורנירים" in `COACH_NAV`, linking to `/coach/tournaments` list) — same
  underlying view; edit controls (add participant via the search-or-create
  flow, mark paid, run draw, enter results, build bracket, mark finished)
  render only for admin or the tournament's assigned manager. Other coaches
  get the identical read-only view.
- **`/admin/players`** (new nav item "שחקנים" in `ADMIN_NAV`) — the global
  player list described above.
- **`/t/[slug]`** — public tournament page, outside the
  `(admin)`/`(coach)`/`(student)` route groups, no auth required. Shows
  tournament name, rules link if set, all house tables (with handicaps), and
  the knockout bracket (with handicaps). No payment status. Every
  participant name links to `/p/[slug]`. Built mobile-first since it's meant
  to be shared over WhatsApp.
- **`/p/[slug]`** — public player profile page, same access model as above.

## Explicitly Out of Scope (YAGNI)

- No in-app payment collection — just a paid/unpaid checkbox per participant.
- No automatic seeding from house standings into the knockout bracket.
- No formal multi-stage status machine — just a `completed` boolean toggle.
- No WhatsApp notifications tied to tournament events (draw complete, match
  result, etc.) in this iteration.
- No retroactive rating recalculation. If a house is re-drawn after results
  already triggered rating changes, or a result is corrected, only the
  matches affected at that moment adjust ratings going forward — the app
  does not replay tournament history to "undo" a previously-applied rating
  change. Accepted as a known simplification; re-drawing after results exist
  is already a rare, confirmation-gated action.
- No admin override of a computed rating (e.g. manually setting someone's
  number) in V1 — ratings only ever move via the ELO formula from match
  results.
- No configurable ELO K-factor — fixed at 32.
- No richer public player profile (e.g. computed final placement per
  tournament, win/loss record) beyond the plain list of tournaments — only
  name, rating, and tournament links.
- No manual name-splitting UI for a newly-created tournament-only student —
  the typed text goes entirely into `first_name`.
