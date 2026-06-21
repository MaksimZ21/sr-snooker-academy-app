"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CoachStats } from "@/app/api/coach/stats/route";

export function CoachBarChart({
  data,
  isLoading,
}: {
  data?: CoachStats;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">מפגשים השבוע</CardTitle>
          {data && (
            <span className="text-xs text-muted-foreground">
              סה״כ {data.weekSessionCount}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data?.sessionsByDay ?? []} barSize={24}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                }}
                formatter={(v) => [`${v} מפגשים`, ""]}
                labelFormatter={() => ""}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(data?.sessionsByDay ?? []).map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.date === data?.today
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.25)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
