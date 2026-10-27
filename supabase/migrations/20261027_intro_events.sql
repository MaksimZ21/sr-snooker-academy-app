-- Intro events ("אירועי היכרות"): CRM calendar events with
-- meeting_type = "אירוע הכירות" (note the CRM's spelling) become their own
-- entity instead of a generic "group" session — see
-- docs/superpowers/specs/2026-10-27-intro-events-design.md. Modeled
-- directly on the tournaments CRM-event pattern (RLS enabled, no
-- policies — service-role access only, via src/lib/sheets/intro-events.ts).

CREATE TABLE intro_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  coach_email TEXT,
  crm_event_id TEXT NOT NULL DEFAULT '',
  crm_appointment_id TEXT NOT NULL DEFAULT '',
  crm_event_type TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX intro_events_crm_appointment_id_unique
  ON intro_events (crm_appointment_id)
  WHERE crm_appointment_id <> '';

CREATE TABLE intro_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intro_event_id UUID NOT NULL REFERENCES intro_events(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  experience_level TEXT,
  goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (intro_event_id, student_id)
);

ALTER TABLE intro_event_participants ADD CONSTRAINT intro_event_participants_experience_level_check
  CHECK (experience_level IS NULL OR experience_level IN ('none', 'hobbyist', 'regular'));

ALTER TABLE intro_event_participants ADD CONSTRAINT intro_event_participants_goal_check
  CHECK (goal IS NULL OR goal IN ('cue_control', 'technique', 'angles', 'beat_friend', 'advance', 'basics'));

ALTER TABLE intro_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intro_event_participants ENABLE ROW LEVEL SECURITY;
