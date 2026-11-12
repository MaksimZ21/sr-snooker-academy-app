-- League level-change tracking (12 ft). Each league result keeps the 12 ft
-- levels both players had when it was entered, and when.
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS level_a TEXT;
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS level_b TEXT;
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS result_at TIMESTAMPTZ;

-- Any change to a player's 12 ft level restarts their count from zero.
ALTER TABLE students ADD COLUMN IF NOT EXISTS skill_level_changed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION stamp_skill_level_change() RETURNS trigger AS $$
BEGIN
  IF NEW.skill_level IS DISTINCT FROM OLD.skill_level THEN
    NEW.skill_level_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS students_skill_level_changed ON students;
CREATE TRIGGER students_skill_level_changed
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION stamp_skill_level_change();
