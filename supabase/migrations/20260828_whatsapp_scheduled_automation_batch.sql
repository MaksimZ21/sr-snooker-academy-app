ALTER TABLE whatsapp_scheduled
  ADD COLUMN IF NOT EXISTS automation_run_id UUID,
  ADD COLUMN IF NOT EXISTS automation_name TEXT;
