# Leagues — Design Spec

Date: 2026-09-13

## Purpose

Alongside one-off tournaments (houses + knockout, already built), the academy wants **leagues**: a season-long competition with one continuous standings table, like a football league — everyone plays everyone (possibly more than once, "כמה סיבובים"), matches are scheduled into weekly rounds, and results come in gradually over the season rather than from a single upfront draw.

Confirmed with the user this is genuinely distinct from a tournament's house stage (which is a single, unordered round-robin pairing list with no round/week structure and no repeat-cycle concept) — not just "a tournament with one house and no knockout."

## Roles & Permissions

Mirrors tournaments exactly:

| Who | Can do |
|---|---|
| Admin | Everything |
| Assigned league manager (a coach) | Add/edit participants, generate the fixture schedule, enter results, mark the league finished |
| Other logged-in coaches | View-only |
| Anyone with the public link (`/l/[slug]`) | View-only, no login required |
| Any logged-in student/customer | View their own league matches and standing, same personal-area treatment as tournaments |

## Data Model

New Supabase tables, following the exact conventions already established for tournaments (RLS enabled, no policies — service-role access only, accessed exclusively through a new `src/lib/sheets/leagues.ts` module).

### `leagues`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| manager_email | text | same convention as `tournaments.manager_email` |
| num_cycles | int, default 1 | how many times each pair meets (1 = single round-robin, 2 = home/away style, etc.) |
| completed | boolean, default false | display filter only, like tournaments |
| public_slug | text, unique | powers `/l/[slug]` |
| handicap_points_per_rating_gap | int, default 20 | same concept and default as tournaments |
| created_at | timestamptz, default now() | |

### `league_participants`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| league_id | uuid, FK | |
| student_id | text, FK to `students.id` | same "player" model as tournaments — search-or-create against the same `students` table, same lazy `public_slug` generation via the existing `ensurePlayerSlug` |
| created_at | timestamptz, default now() | |

No `paid`/`house_id` columns — leagues have no payment tracking (not requested) and no houses.

### `league_matches`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| league_id | uuid, FK | |
| round | int | matchday number, 1-indexed, continuous across cycles (see scheduling below) |
| participant_a_id | uuid, FK | |
| participant_b_id | uuid, FK | |
| frames_a | int, nullable | null = not yet played |
| frames_b | int, nullable | |

Generated all at once when the manager clicks "צור לוח משחקים" (build fixture list) — see scheduling algorithm below. Unlike tournament knockout matches, there's no bracket linkage (`next_match_id`) — a league has no elimination.

## Fixture Scheduling — Round-Robin Circle Method

Pure, new logic (goes in `tournament-logic.ts` alongside the existing round-robin/standings functions — reuses the file's established zero-dependency, fully-tested style):

Given `participantIds` and `numCycles`:
1. If the participant count is odd, add one "bye" placeholder for scheduling purposes only (never produces a real match row).
2. Use the standard circle method: fix one participant, rotate the rest each round. For `n` participants (after the bye-pad, `n` is even), one complete cycle has `n - 1` rounds, each with `n / 2` matches, and every real pair meets exactly once per cycle.
3. Repeat for `numCycles` cycles, with round numbers continuing sequentially across cycles (cycle 2's round 1 is round `n` if cycle 1 had `n - 1` rounds, etc.) — so the whole season is one continuous sequence of rounds, not cycle-scoped.
4. Any match involving the bye placeholder is dropped (that participant simply has no fixture that round) — never produces a `league_matches` row.

This guarantees: every pair meets exactly `numCycles` times over the season, no participant plays twice in the same round, and round numbers are unique and sequential across the whole season.

## Standings

Identical computation to house standings — reuses the existing `computeHouseStandings(participantIds, matches)` as-is (wins desc → frame-difference desc → frames-won desc). One continuous table for the whole league, recomputed at render time from all `league_matches` rows with a recorded result — no stored "points" column, matching the "pure read-time computation" philosophy already used for tournament placements.

## Rating & Handicap

Both fully shared with tournaments, by explicit product decision — a league match is not a separate rating universe:
- Every recorded league result triggers the exact same ELO update (`computeEloUpdate`, K=32) applied to the two players' `students.rating`, exactly like a tournament match. A player's rating reflects all their matches, tournament and league alike, and `/admin/players` shows the same unified number.
- Handicap display uses the exact same `computeHandicapPoints`/`formatHandicapLabel` and the league's own `handicap_points_per_rating_gap` field, shown per fixture exactly like tournament pairings.

## Admin/Coach UI

- **`/admin/leagues`** (new page, new "ליגות" item in `ADMIN_NAV`) — list of leagues (active/completed), "צור ליגה" action. Mirrors `/admin/tournaments`.
- **`/admin/leagues/[id]`** (and `/coach/leagues/[id]` for the manager/other coaches) — league detail: participants list (same search-or-create picker already built for tournaments), "צור לוח משחקים" button (disabled/re-confirm-gated once results exist, same re-draw-guard pattern as houses), standings table, and the fixture list grouped by round with inline result entry per match (same `MatchRow`-style stale-state-safe pattern already used for house/knockout matches — key includes the match's own result fields).
- **`/coach/leagues`** — list page mirroring `/coach/tournaments` (own leagues editable, others view-only).

## Public League Page

### `/l/[slug]`

Mirrors `/t/[slug]` exactly in spirit: no login required, mobile-first, shows the league name, the one continuous standings table, and the fixture list grouped by round (with handicap shown for unplayed pairings, matching the public tournament page's existing house-match display). Every participant name links to `/p/[slug]` — the same public player profile tournaments already use, unchanged.

## Student Personal Area

Extends the existing `/student/tournaments` page (built in Tournaments Phase 6) rather than adding a separate page — same nav item "הטורנירים שלי", same principle of "everyone lands in the same `/student` area." The page gains a second section listing the student's own leagues, each showing their matches (opponent, score, win/loss) and their current standings position — reusing the same `computeHouseStandings`-based placement logic, simpler than the tournament placement algorithm since there's no knockout stage to consider (a league "placement" is just "current position in the one table," always computable once at least one match has a result, no special-casing needed).

## Explicitly Out of Scope (YAGNI, matching the tournaments precedent)

- No in-app payment tracking for leagues (not requested).
- No mid-season joining/leaving — participants are fixed at fixture-generation time, same as a tournament's participant list is fixed once the house draw runs. Adding a participant after the schedule exists is out of scope (re-generating would need to be a full re-draw, same re-confirm-gated pattern as tournaments already use for re-drawing houses).
- No "postponed/rescheduled" match date tracking — a match is either unplayed (no result yet) or played, exactly like tournament matches. No calendar/date field on `league_matches` at all — "the schedule is set a week ahead" is an operational/communication detail outside the app for V1, not a stored field.
- No divisions, promotion/relegation, or multiple concurrent tables within one league.

## Phasing

Given the size, mirrors how tournaments itself was phased:

- **Phase 1** (this plan): data model, round-robin scheduling algorithm + tests, `leagues.ts` data layer, admin/coach UI (create, generate fixtures, enter results, standings) — no public page, no student personal-area integration yet.
- **Phase 2**: `/l/[slug]` public page.
- **Phase 3**: student personal-area integration (extend `/student/tournaments`).
