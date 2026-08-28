"use client";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_CATEGORIES, currentMonth, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals-shared";

const GoalChart = dynamic(() => import("./goal-chart").then((m) => m.GoalChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

export function StudentGoalSummary({ studentId }: { studentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-goals", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/monthly-goal`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { goals: { goal: MonthlyGoal; entries: GoalEntry[] }[] };
    },
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const current = data?.goals.find((g) => g.goal.month === currentMonth());
  if (!current) return null;

  const label = GOAL_CATEGORIES.find((c) => c.key === current.goal.category)?.label ?? current.goal.category;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        מטרה חודשית · {label}
      </p>
      <GoalChart entries={current.entries} category={current.goal.category} />
    </div>
  );
}
