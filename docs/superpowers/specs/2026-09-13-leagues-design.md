# Leagues — Design Spec

Date: 2026-09-13 (revised same day: leagues are divided into districts/houses)

## Purpose

Alongside one-off tournaments (houses + knockout, already built), the academy wants **leagues**: a season-long competition, like a football league — everyone in the same district plays everyone else in that district (possibly more than once, "כמה סיבובים"), matches are scheduled into weekly rounds, and results come in gradually over the season rather than from a single upfront draw.

A league is divided into several **districts** ("בתים"/"מחוזות") — each district runs its own fully independent round-robin season with its own standings table. This is not the "one continuous table for the whole league" originally proposed — the user clarified the academy actually runs multiple regional divisions under one league, each needing its own table.

Confirmed with the user this is genuinely distinct from a tournament's house stage:
- A tournament house is randomly drawn (shuffle + auto-assign) and is a single, unordered round-robin pairing list with no round/week structure and no repeat-cycle concept.
- A league district is **manually assigned** by the manager (real-world geography — a player belongs to whichever district they actually play in, not a random draw), and its fixtures are **scheduled into numbered rounds**, repeated for a configurable number of cycles across the season.

## Roles & Permissions

Mirrors tournaments exactly:

| Who | Can do |
|---|---|
| Admin | Everything |
| Assigned league manager (a coach) | Add participants, assign them to districts, generate each district's fixture schedule, enter results, mark the league finished |
| Other logged-in coaches | View-only |
| Anyone with the public link (`/l/[slug]`) | View-only, no login required |
| Any logged-in student/customer | View their own district's matches and standing, same personal-area treatment as tournaments |

## Data Model

New Supabase tables, following the exact conventions already established for tournaments (RLS enabled, no policies — service-role access only, accessed exclusively through a new `src/lib/sheets/leagues.ts` module).

### `leagues`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| manager_email | text | same convention as `tournaments.manager_email` |
| num_cycles | int, default 1 | how many times each pair meets, applies uniformly to every district in this league (1 = single round-robin, 2 = home/away style, etc.) |
| completed | boolean, default false | display filter only, like tournaments |
| public_slug | text, unique | powers `/l/[slug]` |
| handicap_points_per_rating_gap | int, default 20 | same concept and default as tournaments |
| created_at | timestamptz, default now() | |

### `league_districts`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| league_id | uuid, FK | |
| label | text | a real district/region name the manager types in (e.g. "צפון", "מרכז") — **not** auto-generated like tournament house labels ("בית 1"), since these represent actual geography chosen by the manager |
| created_at | timestamptz, default now() | |

### `league_participants`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| league_id | uuid, FK | |
| student_id | text, FK to `students.id` | same "player" model as tournaments — search-or-create against the same `students` table, same lazy `public_slug` generation via the existing `ensurePlayerSlug` |
| district_id | uuid, nullable, FK to `league_districts` | **manually** set by the manager (not a random draw) — `null` until assigned. A participant with no district yet can't be scheduled into any fixtures |
| created_at | timestamptz, default now() | |

No `paid` column — leagues have no payment tracking (not requested).

### `league_matches`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| district_id | uuid, FK to `league_districts` | a match belongs to exactly one district — there is never a cross-district fixture |
| round | int | matchday number within this district, 1-indexed, continuous across cycles (see scheduling below) — round numbers are **scoped per district**, not shared across the league (district A's round 3 and district B's round 3 are unrelated) |
| participant_a_id | uuid, FK | |
| participant_b_id | uuid, FK | |
| frames_a | int, nullable | null = not yet played |
| frames_b | int, nullable | |

Generated per district when the manager clicks "צור לוח משחקים" for that district — see scheduling algorithm below. Unlike tournament knockout matches, there's no bracket linkage (`next_match_id`) — a league has no elimination.

## Fixture Scheduling — Round-Robin Circle Method

Pure, new logic (goes in `tournament-logic.ts` alongside the existing round-robin/standings functions — reuses the file's established zero-dependency, fully-tested style). Run once per district, against that district's own participant list only:

Given one district's `participantIds` and the league's `numCycles`:
1. If the participant count is odd, add one "bye" placeholder for scheduling purposes only (never produces a real match row).
2. Use the standard circle method: fix one participant, rotate the rest each round. For `n` participants (after the bye-pad, `n` is even), one complete cycle has `n - 1` rounds, each with `n / 2` matches, and every real pair meets exactly once per cycle.
3. Repeat for `numCycles` cycles, with round numbers continuing sequentially across cycles within this district (cycle 2's round 1 is round `n` if cycle 1 had `n - 1` rounds, etc.).
4. Any match involving the bye placeholder is dropped (that participant simply has no fixture that round) — never produces a `league_matches` row.

This guarantees, per district independently: every pair in that district meets exactly `numCycles` times, no participant plays twice in the same round, and round numbers are unique and sequential within that district.

## Standings

Identical computation to house standings — reuses the existing `computeHouseStandings(participantIds, matches)` as-is (wins desc → frame-difference desc → frames-won desc), called once per district against that district's own participants and matches. **One table per district — no combined/overall table across districts** (explicit product decision; districts are independent competitions that happen to share a league wrapper for administrative convenience). No stored "points" column — pure read-time computation, matching the philosophy already used for tournament placements.

## Rating & Handicap

Both fully shared with tournaments, by explicit product decision — a league match is not a separate rating universe:
- Every recorded league result triggers the exact same ELO update (`computeEloUpdate`, K=32) applied to the two players' `students.rating`, exactly like a tournament match. A player's rating reflects all their matches — tournament and league alike — and `/admin/players` shows the same unified number.
- Handicap display uses the exact same `computeHandicapPoints`/`formatHandicapLabel` and the league's own `handicap_points_per_rating_gap` field, shown per fixture exactly like tournament pairings.

## Admin/Coach UI

- **`/admin/leagues`** (new page, new "ליגות" item in `ADMIN_NAV`) — list of leagues (active/completed), "צור ליגה" action. Mirrors `/admin/tournaments`.
- **`/admin/leagues/[id]`** (and `/coach/leagues/[id]` for the manager/other coaches) — league detail:
  - Participants list (same search-or-create picker already built for tournaments), each row with a district-assignment control — a plain `<Select>` of the league's districts (manager picks directly, no shuffle/draw button at all, unlike tournament houses).
  - "הוסף מחוז" — manager types a new district label, added to the league.
  - Per district: "צור לוח משחקים" button (disabled/re-confirm-gated once that district has any result, same re-draw-guard pattern already used for tournament houses), that district's standings table, and its fixture list grouped by round with inline result entry per match (same stale-state-safe row-keying pattern already used for house/knockout matches — key includes the match's own result fields).
- **`/coach/leagues`** — list page mirroring `/coach/tournaments` (own leagues editable, others view-only).

## Public League Page

### `/l/[slug]`

Mirrors `/t/[slug]` exactly in spirit: no login required, mobile-first. Shows the league name, then every district as its own card — standings table plus that district's fixture list grouped by round (with handicap shown for unplayed pairings, matching the public tournament page's existing house-match display) — laid out in the same responsive side-by-side grid the public tournament page already uses for houses. Every participant name links to `/p/[slug]` — the same public player profile tournaments already use, unchanged.

## Student Personal Area

Extends the existing `/student/tournaments` page (built in Tournaments Phase 6) rather than adding a separate page — same nav item "הטורנירים שלי", same principle of "everyone lands in the same `/student` area." The page gains a second section listing the leagues the student is in, each showing their own district's matches (opponent, score, win/loss) and their current standing within that district — reusing the same `computeHouseStandings`-based placement logic, simpler than the tournament placement algorithm since there's no knockout stage to consider (a league placement is just "current position in the district table," always computable once at least one match in that district has a result).

## Explicitly Out of Scope (YAGNI, matching the tournaments precedent)

- No in-app payment tracking for leagues (not requested).
- No combined/overall table across districts (explicit decision above).
- No mid-season joining/leaving or re-assigning a participant to a different district once fixtures exist for that district — participants are fixed at fixture-generation time, same as a tournament's participant list is fixed once the house draw runs. Regenerating a district's schedule after results exist is out of scope for V1 (same re-confirm-gated guard tournaments already use for re-drawing houses covers the "don't silently destroy data" risk).
- No "postponed/rescheduled" match date tracking — a match is either unplayed (no result yet) or played, exactly like tournament matches. No calendar/date field on `league_matches` at all — "the schedule is set a week ahead" is an operational/communication detail outside the app for V1, not a stored field.
- No promotion/relegation between districts.

## Phasing

Given the size, mirrors how tournaments itself was phased:

- **Phase 1** (next up): data model, round-robin scheduling algorithm + tests, `leagues.ts` data layer, admin/coach UI (create league, add districts, assign participants to districts, generate each district's fixtures, enter results, per-district standings) — no public page, no student personal-area integration yet.
- **Phase 2**: `/l/[slug]` public page.
- **Phase 3**: student personal-area integration (extend `/student/tournaments`).
