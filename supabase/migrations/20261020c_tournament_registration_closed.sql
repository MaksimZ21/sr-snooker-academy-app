-- Lets the manager/admin stop the CRM from adding any more participants to
-- a specific tournament (ticket purchases, appointment approvals) once it's
-- full/started, without needing to pause CRM sync globally.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_closed boolean NOT NULL DEFAULT false;
