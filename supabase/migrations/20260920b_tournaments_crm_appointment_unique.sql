-- Blocks duplicate tournaments for the same CRM appointment at the database
-- level. Run this ONLY after duplicate tournaments sharing a non-empty
-- crm_appointment_id have been cleaned up — otherwise it fails.

CREATE UNIQUE INDEX IF NOT EXISTS tournaments_crm_appointment_id_unique
  ON tournaments (crm_appointment_id)
  WHERE crm_appointment_id <> '';
