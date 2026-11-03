# League Breaks Table + District Switcher Design Spec

Date: 2026-11-03

## Purpose

1. Each league gets a high-breaks table covering every district. The league manager enters, by hand, each break a player makes above the league's threshold — the threshold itself is the manager's call and the app never checks it.
2. A league with several districts is hard to read when every district's standings and match list are stacked. Both the admin league page and the public league page get one button per district; pressing it shows only that district.

## Breaks

### Data

```sql
CREATE TABLE league_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value > 0 AND value <= 155),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

155 is the snooker maximum with a free ball; nothing else is validated.

### Table

One row per player who has at least one break: name, district, and every break they've made, highest first (`52 · 45 · 38`). Rows ordered by the player's highest break, then by number of breaks. Players with no breaks don't appear.

Ordering is a pure function, `computeBreakTable`, unit tested, in `tournament-logic.ts` next to `computeLeagueStandings`.

### Entry (admin only)

On the admin league page, a "טבלת ברייקים" section: pick a player, type the break, "הוסף". Each break in the table has an ✕ to delete it (typo fix). `POST /api/leagues/[id]/breaks` and `DELETE /api/leagues/[id]/breaks/[breakId]`, both `canManageLeagues`; `GET /api/leagues/[id]/breaks` for admin and coach. Adding validates the participant belongs to the league.

### Public page

The same table, read-only, below the districts. `fetchPublicLeague` selects only `id, participant_id, value` from `league_breaks`.

## District switcher

A small client component, `DistrictSwitcher`, taking `{ id, label, content }[]`: a row of buttons, one per district; the selected district's content is shown, the first is selected initially. With a single district, no buttons — its content shows directly. Used by `LeagueDistrictsView` (admin) and `PublicLeagueView` (public; server-rendered district content passed in as props).

## Out of Scope

- Linking a break to a specific match or date.
- Checking breaks against a threshold.
- Players entering their own breaks.
