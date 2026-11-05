-- One row per player. Tournaments, leagues and intro events used to create a
-- new student whenever a phone number didn't match exactly, leaving several
-- copies of the same person with their history split between them.
--
-- This merges every copy into one row (a phone number identifies a player;
-- a player with no phone merges only on a full name matching exactly one
-- other player), stores all phones in one format, then blocks new
-- duplicates at the database level. Every removed row is kept in
-- students_merge_log so a wrong merge can be traced.
--
-- All-or-nothing: any error rolls the whole script back.

BEGIN;

CREATE TABLE IF NOT EXISTS students_merge_log (
  id BIGSERIAL PRIMARY KEY,
  kept_id TEXT NOT NULL,
  dropped_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  dropped_row JSONB NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE students_merge_log ENABLE ROW LEVEL SECURITY;

-- Same rules as normalizePhoneLocal in src/lib/phone.ts.
CREATE FUNCTION pg_temp.phone_key(raw TEXT) RETURNS TEXT AS $$
  SELECT CASE WHEN d = '' THEN '' ELSE '0' || ltrim(CASE WHEN d LIKE '972%' THEN substr(d, 4) ELSE d END, '0') END
  FROM (SELECT regexp_replace(COALESCE(raw, ''), '\D', '', 'g') AS d) x
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.name_key(first_name TEXT, last_name TEXT) RETURNS TEXT AS $$
  SELECT lower(btrim(regexp_replace(
    regexp_replace(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''), '["''״׳]', '', 'g'),
    '\s+', ' ', 'g')))
$$ LANGUAGE sql IMMUTABLE;

-- sessions.student_ids / groups.student_ids: swap the id, without duplicates.
-- The column type isn't recorded in any migration, so handle each possibility.
CREATE FUNCTION pg_temp.replace_in_roster(tbl TEXT, p_keep TEXT, p_drop TEXT) RETURNS VOID AS $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'student_ids';

  IF col_type = 'ARRAY' THEN
    EXECUTE format(
      'UPDATE %I SET student_ids = (SELECT array_agg(DISTINCT CASE WHEN t.x = $2 THEN $1 ELSE t.x END) FROM unnest(student_ids) AS t(x)) WHERE $2 = ANY(student_ids)',
      tbl) USING p_keep, p_drop;
  ELSIF col_type = 'jsonb' THEN
    EXECUTE format(
      'UPDATE %I SET student_ids = (SELECT jsonb_agg(DISTINCT CASE WHEN t.x = $2 THEN $1 ELSE t.x END) FROM jsonb_array_elements_text(student_ids) AS t(x)) WHERE student_ids ? $2',
      tbl) USING p_keep, p_drop;
  ELSIF col_type = 'text' THEN
    EXECUTE format(
      'UPDATE %I SET student_ids = (SELECT string_agg(DISTINCT CASE WHEN btrim(t.x) = $2 THEN $1 ELSE btrim(t.x) END, '','') FROM unnest(string_to_array(student_ids, '','')) AS t(x)) WHERE $2 = ANY(SELECT btrim(y) FROM unnest(string_to_array(student_ids, '','')) AS u(y))',
      tbl) USING p_keep, p_drop;
  ELSE
    RAISE EXCEPTION 'unexpected type % for %.student_ids', col_type, tbl;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Both copies are in the same tournament/league: move the dropped
-- participant's matches to the kept one. A match between the two copies goes
-- away. An unplayed match that the other copy also has against the same
-- opponent is a duplicate and goes away too. Played matches are never removed.
CREATE FUNCTION pg_temp.merge_participant_matches(tbl TEXT, p_kept UUID, p_dropped UUID) RETURNS VOID AS $$
DECLARE
  m RECORD;
  opponent UUID;
  unplayed_id UUID;
  played_exists BOOLEAN;
BEGIN
  EXECUTE format(
    'DELETE FROM %I WHERE (participant_a_id = $1 AND participant_b_id = $2) OR (participant_a_id = $2 AND participant_b_id = $1)',
    tbl) USING p_kept, p_dropped;

  FOR m IN EXECUTE format(
    'SELECT id, participant_a_id AS a, participant_b_id AS b, frames_a FROM %I WHERE participant_a_id = $1 OR participant_b_id = $1',
    tbl) USING p_dropped
  LOOP
    opponent := CASE WHEN m.a = p_dropped THEN m.b ELSE m.a END;

    EXECUTE format(
      'SELECT id FROM %I WHERE frames_a IS NULL AND ((participant_a_id = $1 AND participant_b_id = $2) OR (participant_a_id = $2 AND participant_b_id = $1)) LIMIT 1',
      tbl) INTO unplayed_id USING p_kept, opponent;
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I WHERE frames_a IS NOT NULL AND ((participant_a_id = $1 AND participant_b_id = $2) OR (participant_a_id = $2 AND participant_b_id = $1)))',
      tbl) INTO played_exists USING p_kept, opponent;

    IF m.frames_a IS NULL AND (unplayed_id IS NOT NULL OR played_exists) THEN
      EXECUTE format('DELETE FROM %I WHERE id = $1', tbl) USING m.id;
    ELSIF m.frames_a IS NOT NULL AND unplayed_id IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I WHERE id = $1', tbl) USING unplayed_id;
    END IF;
  END LOOP;

  EXECUTE format('UPDATE %I SET participant_a_id = $1 WHERE participant_a_id = $2', tbl) USING p_kept, p_dropped;
  EXECUTE format('UPDATE %I SET participant_b_id = $1 WHERE participant_b_id = $2', tbl) USING p_kept, p_dropped;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.merge_student(p_keep TEXT, p_drop TEXT, p_reason TEXT) RETURNS VOID AS $$
DECLARE
  dropped students%ROWTYPE;
  row_d RECORD;
  kept_row_id UUID;
BEGIN
  SELECT * INTO dropped FROM students WHERE id = p_drop;
  IF NOT FOUND OR p_keep = p_drop THEN RETURN; END IF;

  INSERT INTO students_merge_log (kept_id, dropped_id, reason, dropped_row)
  VALUES (p_keep, p_drop, p_reason, to_jsonb(dropped));

  -- Tournaments
  FOR row_d IN SELECT * FROM tournament_participants WHERE student_id = p_drop LOOP
    SELECT id INTO kept_row_id FROM tournament_participants
    WHERE tournament_id = row_d.tournament_id AND student_id = p_keep;

    IF kept_row_id IS NULL THEN
      UPDATE tournament_participants SET student_id = p_keep WHERE id = row_d.id;
    ELSE
      UPDATE tournament_participants SET
        paid = paid OR row_d.paid,
        payment_method = COALESCE(payment_method, row_d.payment_method),
        arrived = COALESCE(arrived, false) OR COALESCE(row_d.arrived, false),
        house_id = COALESCE(house_id, row_d.house_id),
        location_id = COALESCE(location_id, row_d.location_id)
      WHERE id = kept_row_id;

      PERFORM pg_temp.merge_participant_matches('tournament_house_matches', kept_row_id, row_d.id);

      UPDATE tournament_knockout_matches SET participant_a_id = NULL
      WHERE participant_a_id = row_d.id AND participant_b_id = kept_row_id;
      UPDATE tournament_knockout_matches SET participant_b_id = NULL
      WHERE participant_b_id = row_d.id AND participant_a_id = kept_row_id;
      UPDATE tournament_knockout_matches SET participant_a_id = kept_row_id WHERE participant_a_id = row_d.id;
      UPDATE tournament_knockout_matches SET participant_b_id = kept_row_id WHERE participant_b_id = row_d.id;

      DELETE FROM tournament_participants WHERE id = row_d.id;
    END IF;
  END LOOP;

  -- Leagues
  FOR row_d IN SELECT * FROM league_participants WHERE student_id = p_drop LOOP
    SELECT id INTO kept_row_id FROM league_participants
    WHERE league_id = row_d.league_id AND student_id = p_keep;

    IF kept_row_id IS NULL THEN
      UPDATE league_participants SET student_id = p_keep WHERE id = row_d.id;
    ELSE
      UPDATE league_participants SET district_id = COALESCE(district_id, row_d.district_id) WHERE id = kept_row_id;
      PERFORM pg_temp.merge_participant_matches('league_matches', kept_row_id, row_d.id);
      IF to_regclass('public.league_breaks') IS NOT NULL THEN
        EXECUTE 'UPDATE league_breaks SET participant_id = $1 WHERE participant_id = $2' USING kept_row_id, row_d.id;
      END IF;
      DELETE FROM league_participants WHERE id = row_d.id;
    END IF;
  END LOOP;

  -- Intro events
  FOR row_d IN SELECT * FROM intro_event_participants WHERE student_id = p_drop LOOP
    SELECT id INTO kept_row_id FROM intro_event_participants
    WHERE intro_event_id = row_d.intro_event_id AND student_id = p_keep;

    IF kept_row_id IS NULL THEN
      UPDATE intro_event_participants SET student_id = p_keep WHERE id = row_d.id;
    ELSE
      UPDATE intro_event_participants SET
        experience_level = COALESCE(experience_level, row_d.experience_level),
        goal = COALESCE(goal, row_d.goal)
      WHERE id = kept_row_id;
      DELETE FROM intro_event_participants WHERE id = row_d.id;
    END IF;
  END LOOP;

  -- Monthly goals: one per student per month.
  FOR row_d IN SELECT * FROM student_monthly_goals WHERE student_id = p_drop LOOP
    SELECT id INTO kept_row_id FROM student_monthly_goals
    WHERE month = row_d.month AND student_id = p_keep;

    IF kept_row_id IS NULL THEN
      UPDATE student_monthly_goals SET student_id = p_keep WHERE id = row_d.id;
    ELSE
      UPDATE student_goal_entries e SET goal_id = kept_row_id
      WHERE e.goal_id = row_d.id AND NOT EXISTS (
        SELECT 1 FROM student_goal_entries k WHERE k.goal_id = kept_row_id AND k.session_id = e.session_id
      );
      DELETE FROM student_monthly_goals WHERE id = row_d.id;
    END IF;
  END LOOP;

  -- Attendance: one per student per session; the kept player's status wins.
  DELETE FROM attendance a WHERE a.student_id = p_drop AND EXISTS (
    SELECT 1 FROM attendance k WHERE k.session_id = a.session_id AND k.student_id = p_keep
  );
  UPDATE attendance SET student_id = p_keep WHERE student_id = p_drop;

  UPDATE notes SET student_id = p_keep WHERE student_id = p_drop;
  UPDATE contact_requests SET student_id = p_keep WHERE student_id = p_drop;

  PERFORM pg_temp.replace_in_roster('sessions', p_keep, p_drop);
  PERFORM pg_temp.replace_in_roster('groups', p_keep, p_drop);

  -- Removed first, so its unique values (email, public_slug) can move over.
  DELETE FROM students WHERE id = p_drop;

  -- first and last name move as a pair: "דני כהן" / "" must not become
  -- "דני כהן" / "כהן".
  UPDATE students s SET
    first_name = CASE
      WHEN COALESCE(s.last_name, '') = '' AND COALESCE(dropped.last_name, '') <> '' THEN dropped.first_name
      ELSE COALESCE(NULLIF(s.first_name, ''), dropped.first_name) END,
    last_name = CASE
      WHEN COALESCE(s.last_name, '') = '' AND COALESCE(dropped.last_name, '') <> '' THEN dropped.last_name
      ELSE s.last_name END,
    phone = COALESCE(NULLIF(s.phone, ''), dropped.phone),
    email = COALESCE(NULLIF(s.email, ''), dropped.email),
    college_name = COALESCE(NULLIF(s.college_name, ''), dropped.college_name),
    subscription_type = COALESCE(NULLIF(s.subscription_type, ''), dropped.subscription_type),
    general_notes = CASE
      WHEN COALESCE(s.general_notes, '') = '' THEN dropped.general_notes
      WHEN COALESCE(dropped.general_notes, '') IN ('', s.general_notes) THEN s.general_notes
      ELSE s.general_notes || E'\n' || dropped.general_notes END,
    birth_date = COALESCE(s.birth_date, dropped.birth_date),
    last_payment_date = GREATEST(s.last_payment_date, dropped.last_payment_date),
    public_slug = COALESCE(s.public_slug, dropped.public_slug),
    skill_level = COALESCE(s.skill_level, dropped.skill_level),
    active = s.active OR dropped.active,
    is_tournament_only = s.is_tournament_only AND dropped.is_tournament_only
  WHERE s.id = p_keep;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  grp RECORD;
  i INT;
BEGIN
  -- 1. Same phone number. A real student is kept over a tournament-only copy,
  --    then one with an email (needed to log in), then the oldest.
  FOR grp IN
    SELECT pg_temp.phone_key(phone) AS k,
           array_agg(id ORDER BY is_tournament_only, (COALESCE(email, '') <> '') DESC, id) AS ids
    FROM students
    WHERE length(pg_temp.phone_key(phone)) >= 9
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    FOR i IN 2..array_length(grp.ids, 1) LOOP
      PERFORM pg_temp.merge_student(grp.ids[1], grp.ids[i], 'phone ' || grp.k);
    END LOOP;
  END LOOP;

  -- 2. One format for every number.
  UPDATE students SET phone = pg_temp.phone_key(phone)
  WHERE COALESCE(phone, '') <> pg_temp.phone_key(phone);

  -- 3. No phone, and a full name (at least two words) shared with exactly one
  --    player who has a number: the same person, typed in by hand.
  FOR grp IN
    SELECT p.id AS drop_id, (array_agg(c.id))[1] AS keep_id
    FROM students p
    JOIN students c ON c.id <> p.id
      AND pg_temp.name_key(c.first_name, c.last_name) = pg_temp.name_key(p.first_name, p.last_name)
      AND COALESCE(c.phone, '') <> ''
    WHERE COALESCE(p.phone, '') = ''
      AND pg_temp.name_key(p.first_name, p.last_name) LIKE '% %'
    GROUP BY p.id
    HAVING count(*) = 1
  LOOP
    PERFORM pg_temp.merge_student(grp.keep_id, grp.drop_id, 'name');
  END LOOP;

  -- 4. Several rows with the same full name and no phone anywhere.
  FOR grp IN
    SELECT pg_temp.name_key(first_name, last_name) AS k,
           array_agg(id ORDER BY is_tournament_only, (COALESCE(email, '') <> '') DESC, id) AS ids
    FROM students
    WHERE COALESCE(phone, '') = ''
      AND pg_temp.name_key(first_name, last_name) LIKE '% %'
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM students c
      WHERE COALESCE(c.phone, '') <> '' AND pg_temp.name_key(c.first_name, c.last_name) = grp.k
    ) THEN
      FOR i IN 2..array_length(grp.ids, 1) LOOP
        PERFORM pg_temp.merge_student(grp.ids[1], grp.ids[i], 'name ' || grp.k);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- From here on the database itself refuses a second player with the same number.
CREATE UNIQUE INDEX IF NOT EXISTS students_phone_unique
  ON students (phone)
  WHERE length(phone) >= 9;

COMMIT;
