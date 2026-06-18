CREATE TABLE whatsapp_scheduled (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     TEXT        NOT NULL,
  chat_name   TEXT        NOT NULL DEFAULT '',
  message     TEXT        NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_scheduled ENABLE ROW LEVEL SECURITY;
