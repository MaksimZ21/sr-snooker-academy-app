-- 'student': a training note, shown to the student on their history page (what
-- every note has been until now, so existing notes keep showing). 'team': coach
-- and admin only.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'student';
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_visibility_check;
ALTER TABLE notes ADD CONSTRAINT notes_visibility_check CHECK (visibility IN ('student', 'team'));
