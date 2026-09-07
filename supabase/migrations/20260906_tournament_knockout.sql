CREATE TABLE tournament_knockout_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  slot INT NOT NULL,
  participant_a_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  participant_b_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  frames_a INT,
  frames_b INT,
  next_match_id UUID REFERENCES tournament_knockout_matches(id) ON DELETE SET NULL
);

ALTER TABLE tournament_knockout_matches ENABLE ROW LEVEL SECURITY;
