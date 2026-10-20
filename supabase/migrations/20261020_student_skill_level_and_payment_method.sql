-- Fixed, manually-assigned skill classification per student (replaces the
-- computed rating-gap "handicap" display in tournaments, which stays
-- computed/used for leagues only). Purely informational — no calculation
-- reads this column, see docs decision 2026-10-20.
ALTER TABLE students ADD COLUMN IF NOT EXISTS skill_level text;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_skill_level_check;
ALTER TABLE students ADD CONSTRAINT students_skill_level_check
  CHECK (skill_level IS NULL OR skill_level IN ('A', 'B+', 'B', 'C+', 'C', 'D', 'E'));

-- How a tournament participant paid, alongside the existing `paid` flag.
-- Only meaningful when paid = true; left null otherwise.
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE tournament_participants DROP CONSTRAINT IF EXISTS tournament_participants_payment_method_check;
ALTER TABLE tournament_participants ADD CONSTRAINT tournament_participants_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'credit'));
