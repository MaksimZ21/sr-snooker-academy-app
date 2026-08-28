-- Add tournaments core schema: tournaments and tournament_participants tables.
--
-- Tournaments: stores tournament metadata with manager contact and rules link.
-- Tournament participants: tracks which students are registered for each tournament.
-- Public slugs are unique identifiers for public-facing tournament pages.
-- RLS is enabled but policies will be added in a later migration.

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  rules_url TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT NOT NULL UNIQUE,
  handicap_points_per_rating_gap INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, student_id)
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
