-- Gives house matches a stable, explicit order (mirrors the existing
-- `slot` column on tournament_knockout_matches) — without it, Postgres
-- gives no row-order guarantee at all, so the match list could visibly
-- reshuffle itself after an unrelated edit like entering a result.
ALTER TABLE tournament_house_matches ADD COLUMN IF NOT EXISTS slot INT;
