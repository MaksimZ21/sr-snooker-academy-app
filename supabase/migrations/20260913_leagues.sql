-- Leagues: season-long round-robin competitions, divided into districts
-- ("מחוזות") that each run their own independent schedule and standings
-- table. Mirrors the tournaments schema's conventions exactly (RLS enabled,
-- no policies — service-role access only, via src/lib/sheets/leagues.ts and
-- src/lib/sheets/league-districts.ts).

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  num_cycles INT NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT NOT NULL UNIQUE,
  handicap_points_per_rating_gap INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  district_id UUID REFERENCES league_districts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, student_id)
);

CREATE TABLE league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES league_districts(id) ON DELETE CASCADE,
  round INT NOT NULL,
  participant_a_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  frames_a INT,
  frames_b INT
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
