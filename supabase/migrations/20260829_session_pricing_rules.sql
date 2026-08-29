-- Session auto-pricing: admin-managed keyword -> price rules, matched
-- against a session's name to automatically set its source and price_nis.
--
-- session_pricing_rules: each row is a keyword to match (case-insensitively)
-- against a session's name; on a match, its label becomes the session's
-- source and its price_nis becomes the session's price.
-- sessions.price_manual: true once an admin manually edits a session's
-- price — the automatic rule never overwrites a session once this is set.

CREATE TABLE session_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  price_nis INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS price_manual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE session_pricing_rules ENABLE ROW LEVEL SECURITY;

INSERT INTO session_pricing_rules (label, price_nis) VALUES
  ('מכללה', 150),
  ('אירוע הכרות', 150);
