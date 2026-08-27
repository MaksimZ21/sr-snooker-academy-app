CREATE TABLE whatsapp_automations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_automation_steps (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID        NOT NULL REFERENCES whatsapp_automations(id) ON DELETE CASCADE,
  step_order     INT         NOT NULL,
  time_of_day    TEXT,
  message_type   TEXT        NOT NULL,
  payload        TEXT        NOT NULL
);

ALTER TABLE whatsapp_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_steps ENABLE ROW LEVEL SECURITY;
