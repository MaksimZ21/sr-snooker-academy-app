-- A multi-location tournament's participants are local to that tournament
-- only — a plain name, never a row in the shared students table, never a
-- tracked rating. student_id becomes optional; local_name carries the name
-- for these participants. Exactly one of the two is ever set on a given
-- row, decided by the parent tournament's type (enforced in the
-- addTournamentParticipant data-layer function, not a DB constraint, same
-- convention already used elsewhere in this schema).

ALTER TABLE tournament_participants ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS local_name TEXT;
