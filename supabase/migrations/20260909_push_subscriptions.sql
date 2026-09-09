-- Web Push subscriptions for admin browser/PWA notifications.
-- One row per (admin email, browser/device) — endpoint is the unique
-- per-device push URL from the browser's push service, so re-subscribing
-- the same device (e.g. after a permission reset) upserts in place rather
-- than accumulating duplicate rows.
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
