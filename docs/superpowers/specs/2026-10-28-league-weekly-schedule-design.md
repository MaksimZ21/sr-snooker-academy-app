# League Weekly Schedule Design Spec

Date: 2026-10-28

## Purpose

Leagues already have a fixture pool per district (every pairing, generated once by "צור לוח משחקים"), result entry on the admin league page, standings, and a public page at `/l/[slug]`. What's missing is *when* each match is played.

The admin doesn't play fixed rounds. Each week he runs a WhatsApp availability poll for the league days (Sunday–Wednesday), gives an external AI the poll results plus what hasn't been played yet, and the AI returns that week's schedule: specific pairings on specific days (no times — players arrange the hour themselves). This spec gets that weekly schedule into the app, so it's visible on the league's own pages and results can be entered against it.

Explicitly not in scope: the app's own weekly Schedule (`/admin/schedule`) — league matches never appear there.

## Data Model

`league_matches` gains one column:

| column | type | notes |
|---|---|---|
| scheduled_date | date, nullable | the day this match is scheduled for; null = not scheduled |

`round` stays as-is (still written by fixture generation) but is no longer meaningful to the admin's workflow.

## Input: two ways, both admin-only

### 1. Paste the AI's output

Round trip, all on the admin league page, in a new "לוז" section:

1. **"העתק משחקים פתוחים"** copies a text block to the clipboard: a short instruction telling the AI which output format to use, then every unplayed match grouped by district (`דני כהן - יוסי לוי`). The admin pastes this into the AI together with the poll results — so the AI never has to guess what's still open, and the format instruction travels with the data (no separate prompt to maintain).
2. **"הדבק לוז"** opens a dialog with a textarea. The expected format is one match per line:
   ```
   2.11 | דני כהן - יוסי לוי
   ```
   - Date: `D.M`, `D/M`, `D.M.YYYY` or `D/M/YYYY`, anywhere before the `|` (so `יום ראשון 2.11 | ...` also works). With no year, the year is chosen so the date is nearest to today.
   - Names: separated by ` - ` or ` נגד `.
   - Blank lines and lines without `|` are ignored (lets the AI's heading lines through harmlessly).
3. The dialog shows a preview: each line marked ✓ (matched, with district) or ✗ with a reason. Save writes every ✓ line in one request; ✗ lines are left for manual scheduling.

**Name matching** (per participant of this league): normalized full name (trimmed, whitespace collapsed, quotes removed); if no exact hit, a first name that matches exactly one participant; otherwise ✗ "שם לא נמצא" / "שם לא חד-משמעי".

**Match lookup** for a resolved pair: the unplayed matches (`frames_a` null) between those two participants, in either order.
- None → ✗ "אין משחק פתוח ביניהם" (already played, or not in the same district).
- Prefer one with no `scheduled_date`. If every candidate is already scheduled, take the earliest-scheduled one and mark the line "יועבר מ-<date>" (a match that was scheduled but not played gets moved — common when players couldn't make it).
- The same match resolved twice in one paste → second line ✗ "כפול".

Parsing and matching are a pure, client-safe module (`src/lib/sheets/league-schedule-parse.ts`, no `db` import) with unit tests. The admin page already has the participants and every district's matches loaded, so no parse endpoint is needed.

### 2. Manual

In each district's match list on the admin page, every unplayed match row gets a date field; changing it saves immediately. Clearing it unschedules.

## Saving

`POST /api/leagues/[id]/schedule` with `{ assignments: { matchId: string; date: string | null }[] }` — admin only (`canManageLeagues`). Validates every match belongs to this league (via its district) and is unplayed, then sets `scheduled_date`. Used by paste-save, manual date changes, and "הסר מהלוז".

## Display

### Admin league page — "לוז" section

Above the districts. One week at a time (Sunday–Saturday, default = the week containing today), with ‹ › to move between weeks. Matches grouped by day, each row: the two names, district label, and result inputs that save on blur (same entry flow as the tournament screens), plus "הסר מהלוז". Empty week: "אין משחקים משובצים בשבוע הזה".

### Public league page

A "לוז" section at the top: every scheduled match from the start of the current week onward, grouped by day, each with names, district, and the score once played (otherwise "טרם שוחק"). Standings and the per-district lists below are unchanged. Server-rendered per request, as today.

## Explicitly Out of Scope

- Times for matches (day only, confirmed).
- League matches on the app's weekly Schedule.
- Players entering their own results — admin only, as today.
- Building the schedule inside the app from availability (the external AI keeps doing that).
- Removing the "מחזור N" grouping from the district lists.
