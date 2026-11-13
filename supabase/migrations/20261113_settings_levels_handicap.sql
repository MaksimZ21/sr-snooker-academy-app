-- Settings page: editable level lists (12 ft and 9-10 ft) and a handicap
-- ("פור") table per district.

-- 1. Level lists, ordered best (position 0) to weakest.
CREATE TABLE IF NOT EXISTS skill_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_size text NOT NULL CHECK (table_size IN ('9-10', '12')),
  label text NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (table_size, label)
);

INSERT INTO skill_levels (table_size, label, position) VALUES
  ('12', 'A', 0), ('12', 'B+', 1), ('12', 'B', 2), ('12', 'C+', 3), ('12', 'C', 4),
  ('12', 'D', 5), ('12', 'E', 6), ('12', 'F', 7), ('12', 'G+', 8), ('12', 'G', 9),
  ('12', 'H', 10), ('12', 'I', 11),
  ('9-10', 'A', 0), ('9-10', 'B', 1), ('9-10', 'C', 2), ('9-10', 'D', 3), ('9-10', 'E', 4)
ON CONFLICT (table_size, label) DO NOTHING;

-- The fixed lists are no longer enforced by the database; the app checks
-- against skill_levels instead.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_skill_level_check;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_skill_level_9ft_check;

-- 2. Handicap per district: points per frame for each 12 ft level. Between
-- two players, the weaker one gets the difference.
CREATE TABLE IF NOT EXISTS handicap_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handicap_values (
  district_id uuid NOT NULL REFERENCES handicap_districts(id) ON DELETE CASCADE,
  level_label text NOT NULL,
  points numeric NOT NULL,
  PRIMARY KEY (district_id, level_label)
);

INSERT INTO handicap_districts (name, position) VALUES
  ('תל אביב', 0), ('חיפה', 1), ('פתח תקווה', 2), ('אשדוד', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO handicap_values (district_id, level_label, points)
SELECT d.id, v.level_label, v.points
FROM handicap_districts d
JOIN (VALUES
  ('תל אביב', 'A', 0), ('תל אביב', 'B', 4), ('תל אביב', 'C', 7), ('תל אביב', 'D', 10),
  ('תל אביב', 'E', 12), ('תל אביב', 'F', 14), ('תל אביב', 'G+', 16), ('תל אביב', 'G', 18),
  ('תל אביב', 'H', 20), ('תל אביב', 'I', 24),
  ('חיפה', 'A', 0), ('חיפה', 'B', 2), ('חיפה', 'C', 5), ('חיפה', 'D', 8), ('חיפה', 'E', 12),
  ('פתח תקווה', 'A', 0), ('פתח תקווה', 'B', 6), ('פתח תקווה', 'C', 12), ('פתח תקווה', 'D', 16),
  ('אשדוד', 'A', 0), ('אשדוד', 'B', 3), ('אשדוד', 'C', 8)
) AS v(district, level_label, points) ON v.district = d.name
ON CONFLICT (district_id, level_label) DO NOTHING;
