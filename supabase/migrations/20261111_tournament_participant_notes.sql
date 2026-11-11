-- A short note on a player inside one tournament, for coaches and admins only.
-- Tied to the registration row, so it lives in that tournament and nowhere
-- else, and goes away with it. Its own table on purpose: public and student
-- pages read tournament_participants with select("*").
CREATE TABLE IF NOT EXISTS tournament_participant_notes (
  participant_id UUID PRIMARY KEY REFERENCES tournament_participants(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tournament_participant_notes_tournament_idx
  ON tournament_participant_notes (tournament_id);
