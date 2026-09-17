-- A multi-location tournament has no manager coach — only an admin manages
-- it (see isTournamentManager). A regular tournament keeps its manager
-- coach exactly as before; manager_email is only null for multi_location
-- tournaments.

ALTER TABLE tournaments ALTER COLUMN manager_email DROP NOT NULL;
