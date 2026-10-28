-- The day a league match is scheduled to be played (no time — players
-- arrange the hour themselves). Null = not scheduled. Set by the admin
-- from the league page, either by pasting the weekly schedule an external
-- AI produces or by hand. See
-- docs/superpowers/specs/2026-10-28-league-weekly-schedule-design.md.
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS scheduled_date date;
