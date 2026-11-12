-- Two ratings per player: skill_level (existing) is the 12 ft rating
-- (A, B+, B, C+, C, D, E); skill_level_9ft is the 9-10 ft rating (A-E).
ALTER TABLE students ADD COLUMN IF NOT EXISTS skill_level_9ft TEXT
  CHECK (skill_level_9ft IS NULL OR skill_level_9ft IN ('A', 'B', 'C', 'D', 'E'));

-- Which table a tournament / league is played on. NULL = not set (treated as 12 ft).
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS table_size TEXT
  CHECK (table_size IS NULL OR table_size IN ('9-10', '12'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS table_size TEXT
  CHECK (table_size IS NULL OR table_size IN ('9-10', '12'));
