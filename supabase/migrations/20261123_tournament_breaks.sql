-- High breaks per tournament (used by multi-location tournaments), entered by
-- hand like league_breaks. 155 is the snooker maximum with a free ball.
CREATE TABLE IF NOT EXISTS tournament_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value > 0 AND value <= 155),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tournament_breaks_tournament_idx ON tournament_breaks (tournament_id);

ALTER TABLE tournament_breaks ENABLE ROW LEVEL SECURITY;
