# Tournaments Area — Design Spec

Date: 2026-08-11

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

## Roles & Permissions

| Who | Can do |
|---|---|
| Admin | Create tournaments, assign/change the manager, everything a manager can do (admin is a superuser throughout this app), view all tournaments |
| Assigned tournament manager (a coach) | Add/edit participants, mark who paid, run the house draw, enter house match results, build and play the knockout bracket, mark the tournament as finished |
| Other logged-in coaches | View-only — see the tournament in `/coach/tournaments`, no edit controls |
| Anyone with the public link (`/t/[slug]`) | View-only — standings, houses, bracket, rules link. No payment info. No login required |

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
| created_at | timestamptz, default now() | |

### `tournament_participants`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | uuid, FK | |
| name | text | free-typed by admin — not linked to the `students` table |
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
   (it deletes existing house match data).

## House Stage — Results & Standings

- Each house shows its list of round-robin matches. Each unplayed match has an
  "enter result" action taking a frame score for each side (e.g. 3–1);
  saving computes the winner.
- Each house shows a standings table, recalculated from entered results, with
  columns: **place, name, wins, frames won, frames lost**.
- Ranking order (tie-break rules): wins (desc) → frame difference, i.e.
  frames won − frames lost (desc) → frames won (desc).
- Unplayed matches don't count as 0–0 in the table — they're simply excluded
  from computation so mid-stage standings aren't skewed.
- An "all houses" overview screen shows every house's table side by side —
  this is also what renders on the public page.

## Knockout Stage

Deliberately fully manual — no automatic seeding from house results.

1. Manager picks a bracket size (must be a power of 2 — 4/8/16/32 slots).
2. For each round-1 slot, the manager manually assigns any participant from
   the tournament (not restricted to house winners). An empty slot is a bye
   (auto-advance).
3. Results are entered the same way as house matches (frame score per side).
4. The moment a match's winner is determined, they're automatically written
   into the linked `next_match_id` slot for the following round — no manual
   double entry.
5. Rendered as a standard bracket tree, round 1 through the final, showing
   name + score for played matches and "TBD" for future ones.
6. Also part of the public page (view-only).

## Navigation & Pages

- **`/admin/tournaments`** (new nav item "טורנירים" in `ADMIN_NAV`) — list of
  all tournaments (active first, then completed), "טורניר חדש" button opens a
  create form: name, manager (select from active coaches), rules URL
  (optional). On save, a `public_slug` is generated and the shareable link is
  shown for copying.
- **`/admin/tournaments/[id]`** and **`/coach/tournaments/[id]`** (new nav item
  "טורנירים" in `COACH_NAV`, linking to `/coach/tournaments` list) — same
  underlying view; edit controls (add participant, mark paid, run draw, enter
  results, build bracket, mark finished) render only for admin or the
  tournament's assigned manager. Other coaches get the identical read-only
  view.
- **`/t/[slug]`** — public page, outside the `(admin)`/`(coach)` route groups,
  no auth required. Shows tournament name, rules link if set, all house
  tables, and the knockout bracket. No payment status. Built mobile-first
  since it's meant to be shared over WhatsApp.

## Explicitly Out of Scope (YAGNI)

- No in-app payment collection — just a paid/unpaid checkbox per participant.
- No automatic seeding from house standings into the knockout bracket.
- No linking of tournament participants to existing `students` rows — plain
  typed names only.
- No formal multi-stage status machine — just a `completed` boolean toggle.
- No WhatsApp notifications tied to tournament events (draw complete, match
  result, etc.) in this iteration.
