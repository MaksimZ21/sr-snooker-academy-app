-- New attendance status 'declined': the student said in advance they won't
-- come (CRM appointment_rejected, or set by an admin). Previously stored as
-- 'absent', which is indistinguishable from "didn't show up". The status
-- column was set up with either a CHECK constraint or a Postgres enum (see
-- docs/superpowers/plans/2026-05-24-crm-training-integration.md); handle both.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'declined';
  ELSE
    ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
    ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
      CHECK (status IN ('present', 'absent', 'late', 'confirmed', 'declined'));
  END IF;
END $$;
