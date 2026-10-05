-- CRM appointment_approved events can arrive before the tournament event
-- that creates the tournament they belong to. Park those registrations
-- here, keyed by appointment_id, and attach them once the tournament exists.

CREATE TABLE IF NOT EXISTS crm_pending_registrations (
  id BIGSERIAL PRIMARY KEY,
  appointment_id TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_pending_registrations_appointment_idx
  ON crm_pending_registrations (appointment_id);
