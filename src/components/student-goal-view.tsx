"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GOAL_CATEGORIES, currentMonth, type GoalCategory, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals";

const GoalChart = dynamic(() => import("./goal-chart").then((m) => m.GoalChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full rounded-xl" />,
});

type GoalWithEntries = { goal: MonthlyGoal; entries: GoalEntry[] };

export function StudentGoalView({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<GoalCategory | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-goals", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/monthly-goal`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { goals: GoalWithEntries[] };
    },
  });

  const pickMut = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const r = await fetch(`/api/students/${studentId}/monthly-goal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: selected }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => {
      toast.success("המטרה נשמרה");
      qc.invalidateQueries({ queryKey: ["student-goals", studentId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
      qc.invalidateQueries({ queryKey: ["student-goals", studentId] });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const goals = data.goals;
  const current = goals.find((g) => g.goal.month === currentMonth());
  const past = goals.filter((g) => g.goal.month !== currentMonth());

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <h1 className="text-lg font-semibold">המטרה שלי</h1>

      {!current ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            מטרת העל שלי לחודש הקרוב - אני הכי רוצה לשפר את:
          </p>
          <div className="flex flex-col gap-2">
            {GOAL_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelected(c.key)}
                className={cn(
                  "text-right rounded-xl border-2 p-3 transition-colors",
                  selected === c.key ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
                )}
              >
                <p className="text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
              </button>
            ))}
          </div>
          <Button disabled={!selected || pickMut.isPending} onClick={() => pickMut.mutate()}>
            {pickMut.isPending ? "שומר..." : "אישור"}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            המטרה שלי החודש · {GOAL_CATEGORIES.find((c) => c.key === current.goal.category)?.label}
          </p>
          <GoalChart entries={current.entries} category={current.goal.category} />
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">חודשים קודמים</p>
          {past.map((g) => (
            <PastGoalRow key={g.goal.id} item={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function PastGoalRow({ item }: { item: GoalWithEntries }) {
  const [open, setOpen] = useState(false);
  const label = GOAL_CATEGORIES.find((c) => c.key === item.goal.category)?.label ?? item.goal.category;
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right px-4 py-3 text-sm font-medium"
      >
        {item.goal.month} · {label}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <GoalChart entries={item.entries} category={item.goal.category} />
        </div>
      )}
    </div>
  );
}
