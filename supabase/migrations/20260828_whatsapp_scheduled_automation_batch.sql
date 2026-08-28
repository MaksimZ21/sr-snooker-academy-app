ALTER TABLE whatsapp_scheduled
  ADD COLUMN automation_run_id UUID,
  ADD COLUMN automation_name TEXT;
