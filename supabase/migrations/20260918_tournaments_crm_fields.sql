-- CRM calendar events marked meeting_type = "טורניר" become a regular
-- tournament instead of a session — event_date is what makes it appear on
-- the Schedule; crm_event_id/crm_appointment_id/crm_event_type mirror the
-- identical columns/convention already on the sessions table, used for
-- idempotent upsert-by-CRM-id matching.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS crm_event_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS crm_appointment_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS crm_event_type text NOT NULL DEFAULT '';
