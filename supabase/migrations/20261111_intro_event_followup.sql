-- Follow-up WhatsApp (Meta template "academy_event_followup") sent to each
-- intro event participant the day after the event at 12:00 Israel time.
-- See src/lib/sheets/intro-followup.ts.

ALTER TABLE intro_events
  ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- NULL = not handled yet; 'sending' | 'sent' | 'failed' | 'skipped'
ALTER TABLE intro_event_participants ADD COLUMN IF NOT EXISTS followup_status TEXT;
ALTER TABLE intro_event_participants ADD COLUMN IF NOT EXISTS followup_error TEXT;
ALTER TABLE intro_event_participants ADD COLUMN IF NOT EXISTS followup_at TIMESTAMPTZ;

-- Events that already happened don't get a surprise message on launch day.
UPDATE intro_event_participants
SET followup_status = 'skipped'
WHERE followup_status IS NULL
  AND intro_event_id IN (SELECT id FROM intro_events WHERE event_date < CURRENT_DATE);
