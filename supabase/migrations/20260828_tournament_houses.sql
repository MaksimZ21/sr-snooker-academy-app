CREATE TABLE tournament_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

CREATE TABLE tournament_house_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES tournament_houses(id) ON DELETE CASCADE,
  participant_a_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  frames_a INT,
  frames_b INT
);

ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES tournament_houses(id) ON DELETE SET NULL;

ALTER TABLE tournament_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_house_matches ENABLE ROW LEVEL SECURITY;
