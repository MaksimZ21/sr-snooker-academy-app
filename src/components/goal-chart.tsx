"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { GoalCategory, GoalEntry } from "@/lib/sheets/monthly-goals";

export function GoalChart({ entries, category }: { entries: GoalEntry[]; category: GoalCategory }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">עדיין אין נתונים החודש</p>;
  }

  const data = entries.map((e, i) => ({
    session: `אימון ${i + 1}`,
    value:
      category === "breaks"
        ? e.best_break ?? 0
        : Math.round(((e.success_count ?? 0) / (e.attempt_count || 1)) * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="session" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          allowDecimals={false}
          unit={category === "breaks" ? "" : "%"}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
          }}
          formatter={(v) => [category === "breaks" ? `${v}` : `${v}%`, ""]}
        />
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
