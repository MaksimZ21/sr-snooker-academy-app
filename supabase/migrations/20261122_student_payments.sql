-- Per-student payment tracking (replaces the monthly Google Sheet).
-- last_payment_date already exists on students.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_amount integer,
  ADD COLUMN IF NOT EXISTS next_payment_date date,
  ADD COLUMN IF NOT EXISTS payment_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_frozen boolean NOT NULL DEFAULT false;

-- One row per "שולם" press. The previous dates are kept so a press can be undone.
CREATE TABLE IF NOT EXISTS student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  paid_on date NOT NULL,
  amount integer,
  method text,
  covered_date date,
  prev_last_payment_date date,
  prev_next_payment_date date,
  marked_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_payments_student_idx ON student_payments (student_id, paid_on DESC);
