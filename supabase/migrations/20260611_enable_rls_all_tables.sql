-- Enable Row-Level Security on all tables.
--
-- All server-side data access uses the service role key, which bypasses RLS.
-- The public anon key is used only for Supabase Auth (magic link login).
-- Enabling RLS with no permissive policies blocks all direct REST API access
-- from the browser while leaving server-side operations unaffected.

ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE guidelines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests  ENABLE ROW LEVEL SECURITY;
