# Multi-Location Tournaments — Design Spec

Date: 2026-09-13

## Purpose

Today's tournament format is single-day: participants get randomly drawn into houses (round-robin groups), then advance into a knockout bracket. The academy also runs longer tournaments spanning **multiple physical locations** (different halls/clubs) — each location running its own houses, with the whole tournament finishing into one shared knockout stage.

This is a genuinely different tournament shape, not a variant of the existing one: grouping is manual (a player belongs to whichever location they actually play at — there's no meaningful "random draw" across physical places), and it adds a layer above houses that today's tournament has no concept of.

## Tournament Type

A tournament gets a `type` field, chosen once at creation time and fixed afterward:
- `regular` (default) — today's exact format, completely unchanged: random house draw, single knockout bracket. Every existing tournament is `regular`.
- `multi_location` — the new format described in this document.

The type determines which admin/coach UI the tournament detail page shows for the houses stage. The knockout stage UI and logic are identical for both types.

## Roles & Permissions

Identical to the existing tournament rules — no changes. Admin: everything. Assigned tournament manager (a coach): everything below "Admin" in the existing tournament permission table. Other coaches: view-only. Public link, student personal area: view-only (both already exist for `regular` tournaments; multi-location support in those views is deferred — see Phasing).

## Data Model

### `tournaments` (existing table, modified)
| column | type | notes |
|---|---|---|
| type | text, default `'regular'`, check in (`'regular'`, `'multi_location'`) | set at creation, never changed afterward |

### `tournament_locations` (new table)
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | uuid, FK cascade | |
| label | text | manager types a real place name (e.g. "אולם צפון") — free text, not auto-generated, same reasoning as league district labels |
| created_at | timestamptz, default now() | |

RLS enabled, no policies — service-role only, same convention as every other tournament/league table.

### `tournament_participants` (existing table, modified)
| column | type | notes |
|---|---|---|
| location_id | uuid, nullable, FK to `tournament_locations`, on delete set null | manually assigned by the manager. Only meaningful for `multi_location` tournaments — always null for `regular` ones. `null` means "not yet assigned to a location" |

### `tournament_houses` (existing table, modified)
| column | type | notes |
|---|---|---|
| location_id | uuid, nullable, FK to `tournament_locations`, on delete set null | which location this house belongs to. Always null for a `regular` tournament's houses (created via the existing random draw). For `multi_location`, every house is created manually within a location and always has this set |

No changes to `tournament_house_matches` or the knockout tables — completely untouched.

## Behavior for a `multi_location` Tournament

### No random draw

The existing "הגרל בתים" (draw houses) button and its underlying `runHouseDraw` function are for `regular` tournaments only. For `multi_location`, the data layer refuses any attempt to run a draw (defense in depth — the UI for this type never shows the button at all, but the guard exists at the data layer too, matching the codebase's established belt-and-suspenders pattern).

### Locations

The manager adds locations by typing a label (mirrors "הוסף מחוז" in leagues). No limit on how many. No delete-location capability in this phase — matches the existing precedent that league districts can't be deleted either (never requested, and once a location has participants or houses, deleting it would raise the same data-integrity questions districts already avoid by not supporting deletion).

Creating a location (and, by extension, assigning a participant to one) is refused for a `regular` tournament — defense in depth, matching the same belt-and-suspenders reasoning as the random-draw guard above. The admin/coach UI never exposes these actions for a `regular` tournament in the first place.

### Assigning participants to a location

In the tournament's participants list, each row gets a `<Select>` of the tournament's locations (mirrors the existing league district-assignment `<Select>`), value `null` = "ללא מיקום" (not yet assigned). Assigning or changing a participant's location is refused while that participant is currently in a house (see "Removing a participant from a house" below) — this keeps a house's location and its members' locations from ever silently disagreeing.

### Houses within a location

Within each location, the manager manually creates houses by typing a free-text label (not auto-numbered "בית 1" — these are real, manager-chosen labels, same reasoning as house labels not applying here the way they do for the random-draw case). No shuffle: the manager places participants into houses one at a time.

Assigning a participant into a house reuses the existing `moveParticipantToHouse` mechanism (already builds round-robin matches incrementally against whoever's already in the house, already refuses to move someone who's already played a match in their current house), with one added check: the target house's `location_id` must equal the participant's own `location_id` — a participant can only be placed into a house within the location they're already assigned to.

A participant assigned to a location but not yet placed into any house is shown in that location's card as "לא משוייכים לבית" (unassigned), with a control to pick a house for them.

### Removing a participant from a house

A new, small action: clears a participant's `house_id` and deletes their pending (unplayed) matches in that house — refused if any of those matches already has a result, exactly like the existing move-between-houses guard. This is the explicit step required before a participant's location can be changed once they're already placed in a house — no implicit cascading side effects.

### Standings

Each house shows its own standings table, computed exactly the same way as today's `regular` tournament houses (`computeHouseStandings`, unchanged). **No combined table at the location level or the tournament level** — a location is purely an organizational grouping, same decision already made for league districts.

### Knockout stage

Completely unchanged. The manager builds the bracket (`createKnockoutBracket`) and manually places whoever they choose into round-1 slots (`assignParticipantToSlot`) — the exact same manual mechanism that already exists for `regular` tournaments today. This is what makes it a single shared finish line across every location: any participant from any location/house can be placed into any slot.

## Rating & Handicap

Unchanged — every recorded result (house or knockout) triggers the same ELO update and handicap display already used everywhere else in the app. No new rating logic.

## Admin/Coach UI

- **`/admin/tournaments`** — the "צור טורניר" dialog gains a type selector (`<Select>`: "רגיל" / "רב-מיקומי", default "רגיל"). Everything else about this page is unchanged.
- **`/admin/tournaments/[id]`** (and `/coach/tournaments/[id]`) — the participants list gains the location `<Select>` per row when `tournament.type === 'multi_location'` (hidden entirely for `regular` tournaments). Below the participants list, the page renders:
  - `TournamentHousesView` (existing, unchanged) when `type === 'regular'`.
  - A new `TournamentLocationsView` when `type === 'multi_location'` — lists locations, each location card shows its houses (add-house control, standings + match list with inline result entry per house, same stale-state-safe row-keying and whitespace-input-rejection already used everywhere else) plus its unassigned-participants sub-list.
  - The knockout section (existing `TournamentKnockoutView`, unchanged) renders for both types identically, below whichever houses/locations view is showing.

## Explicitly Out of Scope (YAGNI, matching the leagues precedent)

- No deleting a location once created.
- No combined standings table across houses within a location, or across the whole tournament.
- No changing a tournament's type after creation.
- No location awareness anywhere outside `/admin` and `/coach` in this phase — the public tournament page (`/t/[slug]`) and the student personal area (`/student/tournaments`) keep rendering all of a multi-location tournament's houses in the same flat grid/list they already use for `regular` tournaments, with no location grouping or labeling. This is a deliberate, temporary limitation of this phase, not an oversight — closing it is Phase 2.
- No automatic "who qualifies for the knockout" computation of any kind — the manager decides who goes into the bracket, exactly as they already do for `regular` tournaments.

## Phasing

Mirrors how leagues itself was phased:

- **Phase 1** (next up): data model, `tournament-locations.ts` data layer, admin/coach UI (create a multi-location tournament, add locations, assign participants to locations, add houses within a location, assign participants into houses, enter house results, per-house standings) — no location awareness on the public page or student personal area yet.
- **Phase 2**: teach the public tournament page (`/t/[slug]`) and student personal area (`/student/tournaments`) to group a multi-location tournament's houses by location.
