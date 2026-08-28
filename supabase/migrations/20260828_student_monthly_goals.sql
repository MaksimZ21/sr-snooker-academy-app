CREATE TABLE student_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(id),
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month)
);

CREATE TABLE student_goal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES student_monthly_goals(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  success_count INT,
  attempt_count INT,
  best_break INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (goal_id, session_id)
);

ALTER TABLE student_monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_goal_entries ENABLE ROW LEVEL SECURITY;
