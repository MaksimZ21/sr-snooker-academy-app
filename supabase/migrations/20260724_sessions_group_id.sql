ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS group_id text;
