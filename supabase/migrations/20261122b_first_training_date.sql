-- The first training after the latest payment (from the student's group sessions).
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_training_date date;
ALTER TABLE student_payments
  ADD COLUMN IF NOT EXISTS first_training_date date,
  ADD COLUMN IF NOT EXISTS prev_first_training_date date;
