-- Add CRM fields to sessions table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS address       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS crm_event_id  text NOT NULL DEFAULT '';
