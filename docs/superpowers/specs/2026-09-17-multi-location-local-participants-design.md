# Multi-Location Tournaments — Local (Non-Saved) Participants Design Spec

Date: 2026-09-17

## Purpose

Amends the multi-location tournaments feature (`docs/superpowers/specs/2026-09-13-tournaments-multi-location-design.md`, Phase 1 already shipped). That phase reused the exact same participant model as `regular` tournaments: every participant, even a first-time walk-in, gets a row created in the shared `students` table (`is_tournament_only: true`), a `public_slug`, and a rating that's shared across every tournament and league in the app.

For a `multi_location` tournament specifically, that's the wrong model. These are large, one-off events (the kind that spans several physical locations) where most entrants are not existing academy students and never will be — they're there for that event only. The product decision: **a multi-location tournament's participants are local to that tournament** — a plain name, nothing more. They never touch the shared `students` table, never get a rating, never get a public player profile.

`regular` tournaments and leagues are completely unaffected by this spec — they keep the existing shared-student, shared-rating model exactly as it is today.

## Data Model

### `tournament_participants` (existing table, modified)
| column | type | notes |
|---|---|---|
| student_id | text, **now nullable** | FK to `students.id`, as before — but now only ever set for a `regular` tournament's participants |
| local_name | text, nullable | the participant's name, typed directly by the manager — only ever set for a `multi_location` tournament's participants |

Exactly one of `student_id` / `local_name` is set on any given row, determined entirely by the parent tournament's `type` — never both, never neither. This isn't enforced by a DB constraint in this phase (matching the codebase's existing style of enforcing this kind of invariant in the data-layer function, not a CHECK constraint) — `addTournamentParticipant` is the single place that decides which one to set, based on the tournament's `type`.

No other schema changes. `tournament_house_matches` and `tournament_knockout_matches` already reference `tournament_participants.id`, not `student_id` directly — houses, knockout brackets, and standings computation (`computeHouseStandings`, pure win/frame arithmetic) need no changes at all, since none of them ever look at `student_id`.

## Adding a Participant

`addTournamentParticipant(tournamentId, input)` branches on the tournament's `type`:
- **`regular`** (unchanged): existing search-or-create-a-student flow, `ensurePlayerSlug`, everything as it is today.
- **`multi_location`**: input is just `{ localName: string }`. Inserts a `tournament_participants` row with `local_name` set, `student_id` null. No `students` table involvement whatsoever — no search, no creation, no slug.

The admin/coach "add participant" UI for a `multi_location` tournament is a plain name field and a button — no search-as-you-type picker (that picker stays exactly as it is today for `regular` tournaments and leagues, both explicitly unaffected).

## Rating & Handicap — Skipped Entirely

- Recording a house or knockout result for a `multi_location` tournament still updates the match's `frames_a`/`frames_b` and therefore still affects standings/who-advances exactly as today (`computeHouseStandings` doesn't care about ratings).
- The ELO update step (`computeEloUpdate` + the two `students.rating` writes) is skipped entirely when either side of the match has no `student_id`. This requires **no new code**: `enterHouseMatchResult`/`enterKnockoutMatchResult` already look up each side's `students` row by `student_id` and already bail out (`if (!sa || !sb) return`) when that lookup comes back empty — which it always does for a `null` `student_id`, since `.in("id", [null, ...])` never matches a row in Postgres. The existing "student record vanished" defensive path doubles, unmodified, as "there was never a student to begin with."
- Handicap display (`computeHandicapPoints`/`formatHandicapLabel`) also needs **no new code**: `formatHandicapLabel` already returns `""` when the two ratings are equal (`diff === 0`), and every local participant's stand-in rating is the same dummy `1000` (see below) — so the computed gap between any two local participants is always zero, and the existing `{handicap && !played && <p>...}` rendering guard already used everywhere already suppresses the line. No view component needs a "skip handicap for multi_location" branch.

## Display — One Fallback Point, Not Many

Every consumer of a participant's name already reads it the same way: `[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")`, off a `student` object joined in at the data layer (`fetchTournamentDetail` for admin/coach, the equivalent join in `tournaments-public.ts` for the public page). Rather than teach every view component (`tournament-detail-view.tsx`, `tournament-locations-view.tsx`, `tournament-knockout-view.tsx`, `public-tournament-view.tsx`) to separately check "is this local?", the fallback happens **once, in each of those two join points**: when a participant row has no `student_id`, synthesize a `student`-shaped stand-in from `local_name` instead of looking one up — `{ id: "", first_name: p.local_name ?? "?", last_name: "", phone: "", public_slug: null, rating: 1000 }`. Every existing display line keeps working unmodified, because it already only ever reads `student.first_name`/`last_name`/`phone`/`rating`/`public_slug` — it never needed to know whether the row behind it was a real student.

This also means the existing "(נמחק)" fallback (today's placeholder for "the joined student row is gone") must stay conditioned on `student_id` being **non-null but not found** — a genuinely different case from "this row was never a student," which must resolve to `local_name` instead.

The stand-in's `rating: 1000` is never actually read anywhere for a local participant, because the rating/handicap call sites are gated on `student_id` being non-null (see above) before they ever touch a rating — the placeholder value only exists to satisfy the shared `student` shape's type, not to mean anything.

The one genuine per-view difference: the public tournament page never renders a local participant's name as a `/p/[slug]` link (their stand-in's `public_slug` is `null`, and the existing `p?.publicSlug ? <a>...</a> : <span>...</span>` branches already handle a null `publicSlug` correctly with no changes needed).

The `paid`/`house_id`/`location_id` mechanics are completely unaffected — a local participant is assigned to a location and a house, gets marked paid, and can be removed, exactly like any other participant.

## Public Page: Find-Yourself Search

Because a multi-location tournament can span many locations and houses, the public page (`/t/[slug]`) gains a search-by-name box, **shown only when the tournament has locations** (i.e., only for `multi_location` tournaments — a `regular` tournament's public page is completely unchanged). Typing a name narrows the page down to just the location card(s) containing a participant whose name matches (case-insensitive substring match) — so a player can quickly find which house they're in without scrolling through every location. The matched location's own card still shows in full (standings + fixtures), not just the matching row, so a player sees their whole group's schedule at a glance. Clearing the search shows every location again.

## Explicitly Out of Scope (YAGNI)

- No editing a local participant's name after creation (a typo means removing and re-adding, same constraint that already exists — only possible before they've played a match).
- No path to "convert" a local participant into a real registered student later, even if they turn out to be one.
- No search-by-name box on `regular` tournament or league public pages — this is scoped to `multi_location` only, per the reasoning above (smaller participant counts, single location, less need).
- No change to `paid` tracking, removal rules, or the location/house assignment mechanics already built in Phase 1 — only the participant identity model and rating/handicap changes.
