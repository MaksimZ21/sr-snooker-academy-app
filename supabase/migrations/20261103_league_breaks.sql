-- High breaks per league, entered by hand by the league manager (who decides
-- the threshold — the app doesn't check it). See
-- docs/superpowers/specs/2026-11-03-league-breaks-and-district-switcher-design.md.
-- 155 is the snooker maximum with a free ball.
CREATE TABLE league_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value > 0 AND value <= 155),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX league_breaks_league_idx ON league_breaks (league_id);

ALTER TABLE league_breaks ENABLE ROW LEVEL SECURITY;
