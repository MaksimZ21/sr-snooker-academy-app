-- Each league district uses one handicap table from the settings page.
ALTER TABLE league_districts
  ADD COLUMN IF NOT EXISTS handicap_district_id uuid REFERENCES handicap_districts(id) ON DELETE SET NULL;

-- Existing districts pick the handicap table with the same name.
UPDATE league_districts ld
SET handicap_district_id = hd.id
FROM handicap_districts hd
WHERE ld.handicap_district_id IS NULL AND trim(ld.label) = hd.name;
