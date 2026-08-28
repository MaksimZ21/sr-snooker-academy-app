import { db } from "@/lib/db/client";
import { todayIsoTel } from "@/lib/date";

export type GoalCategory = "technique" | "angle" | "cue_ball_control" | "breaks";

export const GOAL_CATEGORIES: { key: GoalCategory; label: string; description: string }[] = [
  { key: "technique", label: "טכניקה", description: "שיפור כניסה למכה ו/או הוצאת המכה" },
  { key: "angle", label: "זווית", description: "שיפור אחוז ההצלחה בהכנסת כדורים ממרחקים קצרים" },
  { key: "cue_ball_control", label: "שליטה בלבן", description: "שיפור הדיוק בשליטה בלבן בנוסף להכנסת כדורים" },
  { key: "breaks", label: "ברייקים", description: "שיפור הרצף האישי שלי" },
];

export type MonthlyGoal = {
  id: string;
  student_id: string;
  month: string;
  category: GoalCategory;
  created_at: string;
};

export type GoalEntry = {
  id: string;
  goal_id: string;
  session_id: string;
  success_count: number | null;
  attempt_count: number | null;
  best_break: number | null;
  created_at: string;
};

// Every month computation in this file goes through here — never raw
// `new Date()`/`toISOString()`, which is UTC and can disagree with the
// Israel-local calendar month near midnight (the same class of bug fixed
// once already in this codebase's group-session sync).
export function currentMonth(): string {
  return todayIsoTel().slice(0, 7);
}

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

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
    .in("goal_id", goalIds)
    .order("created_at", { ascending: true });
  const entryRows = (entries ?? []) as GoalEntry[];

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
