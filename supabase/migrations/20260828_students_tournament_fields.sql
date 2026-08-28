-- Add tournament-related columns to students table.
--
-- is_tournament_only: marks students who participate only in tournaments (not regular coaching).
-- rating: player rating used for tournament handicap calculations (starts at 1000).
-- public_slug: unique identifier for public student profiles (e.g., tournament leaderboards).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_tournament_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
