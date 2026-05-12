-- Add CRM fields and remove legacy fields from students table
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS first_name        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name         text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email             text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS college_name      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subscription_type text NOT NULL DEFAULT '';

ALTER TABLE students
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS parent_name,
  DROP COLUMN IF EXISTS parent_phone;
