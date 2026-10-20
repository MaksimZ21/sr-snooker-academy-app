-- Whether a participant actually showed up on tournament day — independent
-- of `paid`, since paying in advance doesn't guarantee attendance.
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS arrived boolean NOT NULL DEFAULT false;
