import { db } from "@/lib/db/client";
import {
  currentMonth,
  monthOf,
  type GoalCategory,
  type MonthlyGoal,
  type GoalEntry,
} from "./monthly-goals-shared";

// Types/constants/pure helpers are defined in ./monthly-goals-shared (which
// has no dependency on the server-only `db` client) and re-exported here so
// every existing server-side import of them from "@/lib/sheets/monthly-goals"
// keeps working unchanged. Client components must import them directly from
// ./monthly-goals-shared instead — importing them from THIS file, even as a
// re-export, still evaluates this module's own `import { db } from
// "@/lib/db/client"` and crashes in the browser with "supabaseKey is
// required" (SUPABASE_SERVICE_ROLE_KEY is never exposed client-side). This
// file must stay server-only.
export {
  GOAL_CATEGORIES,
  currentMonth,
  monthOf,
  type GoalCategory,
  type MonthlyGoal,
  type GoalEntry,
} from "./monthly-goals-shared";

export async function fetchStudentGoals(
  studentId: string,
): Promise<{ goal: MonthlyGoal; entries: GoalEntry[] }[]> {
  const { data: goals } = await db
    .from("student_monthly_goals")
    .select("*")
    .eq("student_id", studentId)
    .order("month", { ascending: false });
  const goalRows = (goals ?? []) as MonthlyGoal[];
  if (!goalRows.length) return [];

  const goalIds = goalRows.map((g) => g.id);
  const { data: entries } = await db
    .from("student_goal_entries")
    .select("*")
    .in("goal_id", goalIds);
  const entryRows = (entries ?? []) as GoalEntry[];

  // Order entries chronologically by their underlying session's date, not
  // by when the entry row itself was inserted — a coach might record an
  // earlier session's number after already recording a later session's,
  // and the chart's x-axis labels ("אימון 1", "אימון 2", ...) depend on
  // this array's order matching real session chronology.
  const sessionIds = [...new Set(entryRows.map((e) => e.session_id))];
  const { data: sessionRows } = sessionIds.length
    ? await db.from("sessions").select("id, date").in("id", sessionIds)
    : { data: [] as { id: string; date: string }[] };
  const dateBySessionId = new Map((sessionRows ?? []).map((s) => [s.id as string, s.date as string]));
  entryRows.sort((a, b) => {
    const dateA = dateBySessionId.get(a.session_id) ?? "";
    const dateB = dateBySessionId.get(b.session_id) ?? "";
    return dateA.localeCompare(dateB);
  });

  return goalRows.map((goal) => ({
    goal,
    entries: entryRows.filter((e) => e.goal_id === goal.id),
  }));
}

export async function fetchGoalForMonth(studentId: string, month: string): Promise<MonthlyGoal | null> {
  const { data } = await db
    .from("student_monthly_goals")
    .select("*")
    .eq("student_id", studentId)
    .eq("month", month)
    .maybeSingle();
  return (data as MonthlyGoal) ?? null;
}

export async function createMonthlyGoal(studentId: string, category: GoalCategory): Promise<MonthlyGoal> {
  const { data, error } = await db
    .from("student_monthly_goals")
    .insert({ student_id: studentId, month: currentMonth(), category })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("כבר נבחרה מטרה החודש");
    throw new Error(error.message);
  }
  return data as MonthlyGoal;
}

export async function fetchGoalsForSessionStudents(
  sessionId: string,
  studentIds: string[],
  sessionMonth: string,
): Promise<Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }>> {
  const result: Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }> = {};
  for (const id of studentIds) result[id] = { goal: null, entry: null };
  if (!studentIds.length) return result;

  const { data: goals } = await db
    .from("student_monthly_goals")
    .select("*")
    .in("student_id", studentIds)
    .eq("month", sessionMonth);
  const goalRows = (goals ?? []) as MonthlyGoal[];
  if (!goalRows.length) return result;

  const goalIds = goalRows.map((g) => g.id);
  const { data: entries } = await db
    .from("student_goal_entries")
    .select("*")
    .in("goal_id", goalIds)
    .eq("session_id", sessionId);
  const entryRows = (entries ?? []) as GoalEntry[];

  for (const goal of goalRows) {
    result[goal.student_id] = {
      goal,
      entry: entryRows.find((e) => e.goal_id === goal.id) ?? null,
    };
  }
  return result;
}

export async function upsertGoalEntry(
  sessionId: string,
  goalId: string,
  input: { successCount: number; attemptCount: number } | { bestBreak: number },
): Promise<void> {
  const row =
    "bestBreak" in input
      ? { goal_id: goalId, session_id: sessionId, success_count: null, attempt_count: null, best_break: input.bestBreak }
      : { goal_id: goalId, session_id: sessionId, success_count: input.successCount, attempt_count: input.attemptCount, best_break: null };
  const { error } = await db
    .from("student_goal_entries")
    .upsert(row, { onConflict: "goal_id,session_id" });
  if (error) throw new Error(error.message);
}
