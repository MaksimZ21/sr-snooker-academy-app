-- Leagues no longer have a manager coach — the admin manages every league
-- directly (unlike tournaments, which do have a per-tournament manager).
-- Also: num_cycles moves from the league to each district individually,
-- since different districts in the same league can run a different number
-- of cycles.

ALTER TABLE leagues DROP COLUMN IF EXISTS manager_email;
ALTER TABLE leagues DROP COLUMN IF EXISTS num_cycles;

ALTER TABLE league_districts
  ADD COLUMN IF NOT EXISTS num_cycles INT NOT NULL DEFAULT 1;
