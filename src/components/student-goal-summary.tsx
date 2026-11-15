"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GOAL_CATEGORIES,
  currentMonth,
  type MonthlyGoal,
  type GoalEntry,
  type GoalCategory,
} from "@/lib/sheets/monthly-goals-shared";

const GoalChart = dynamic(() => import("./goal-chart").then((m) => m.GoalChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

export function StudentGoalSummary({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<GoalCategory | "">("");

  const { data, isLoading } = useQuery({
    queryKey: ["student-goals", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/monthly-goal`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { goals: { goal: MonthlyGoal; entries: GoalEntry[] }[] };
    },
  });

  const setGoalMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const r = await fetch(`/api/students/${studentId}/monthly-goal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: selected }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשמירה");
      }
    },
    onSuccess: () => {
      toast.success("היעד נשמר");
      qc.invalidateQueries({ queryKey: ["student-goals", studentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירה"),
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  const current = data?.goals.find((g) => g.goal.month === currentMonth());

  if (!current) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          מטרה חודשית
        </p>
        <p className="text-xs text-muted-foreground">
          התלמיד עוד לא בחר יעד לחודש זה באפליקציה — אפשר להזין ידנית:
        </p>
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={(v) => setSelected((v as GoalCategory) ?? "")}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="בחר יעד..." />
            </SelectTrigger>
            <SelectContent>
              {GOAL_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selected || setGoalMut.isPending}
            onClick={() => setGoalMut.mutate()}
          >
            {setGoalMut.isPending ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

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
