import { todayIsoTel } from "@/lib/date";

// Client-safe: types, constants, and pure date helpers for the monthly
// goal feature — NOT the data-access functions (those live in
// ./monthly-goals, which imports the server-only service-role `db`
// client). This split exists specifically so client components can pull
// in GOAL_CATEGORIES/currentMonth/the shared types without transitively
// bundling `db` (and its SUPABASE_SERVICE_ROLE_KEY read) into the browser.

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

export function currentMonth(): string {
  return todayIsoTel().slice(0, 7);
}

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}
