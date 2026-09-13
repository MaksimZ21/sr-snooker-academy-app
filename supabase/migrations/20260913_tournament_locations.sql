-- Multi-location tournaments: a tournament is either 'regular' (today's
-- format, unchanged — random house draw, single knockout) or
-- 'multi_location' (manual locations, each with manually-built houses,
-- finishing into the same shared, manually-placed knockout bracket).

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'multi_location'));

CREATE TABLE tournament_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tournament_locations(id) ON DELETE SET NULL;

ALTER TABLE tournament_houses
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tournament_locations(id) ON DELETE SET NULL;

ALTER TABLE tournament_locations ENABLE ROW LEVEL SECURITY;
