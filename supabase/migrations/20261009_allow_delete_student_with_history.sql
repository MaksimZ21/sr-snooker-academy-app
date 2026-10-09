-- Deleting a student must not destroy their tournament/league match
-- history, nor their opponents' — a match belongs to two participants,
-- and removing one side's student row should never cascade away the
-- match (and the other side's recorded result) entirely.
--
-- fetchTournamentDetail/fetchLeagueDetail already handle a
-- tournament_participants/league_participants row whose student_id no
-- longer resolves to a real student — they fall back to a "(נמחק)"
-- display. That fallback has been in place since these features were
-- built; the FK constraint below was just never relaxed to actually
-- allow the student row it anticipates being gone. Dropping it (instead
-- of ON DELETE SET NULL) is deliberate: student_id keeps its old value,
-- which is exactly what makes the existing "(נמחק)" lookup resolve
-- correctly — a nulled student_id would instead fall into the
-- multi-location "local participant" branch and show "?" instead.

ALTER TABLE tournament_participants DROP CONSTRAINT IF EXISTS tournament_participants_student_id_fkey;
ALTER TABLE league_participants DROP CONSTRAINT IF EXISTS league_participants_student_id_fkey;
