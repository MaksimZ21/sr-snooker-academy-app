"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminStats } from "@/app/api/admin/stats/route";

const TYPE_COLORS: Record<string, string> = {
  private: "#3b82f6",
  group: "#10b981",
  beginners: "#f59e0b",
  advanced: "#8b5cf6",
  technique: "#f97316",
  "match-play": "#f43f5e",
};

const BRAND = "#0b9e70";
const BRAND_FAINT = "rgba(11,158,112,0.18)";

export function AdminChartsRow({
  data,
  isLoading,
}: {
  data?: AdminStats;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
      {/* Bar chart — sessions per day */}
      <Card className="md:col-span-2">
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
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.sessionsByDay ?? []} barSize={28}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                  formatter={(v) => [`${v} מפגשים`, ""]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data?.sessionsByDay ?? []).map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={entry.date === data?.today ? BRAND : BRAND_FAINT}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut chart — by type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">לפי סוג אימון</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : !data?.sessionsByType.length ? (
            <p className="text-xs text-muted-foreground text-center py-10">אין נתונים השבוע</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={data.sessionsByType}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                  >
                    {data.sessionsByType.map((entry) => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v, _n, p) => [`${v} מפגשים`, p.payload.label]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {data.sessionsByType.map((t) => (
                  <div key={t.type} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[t.type] ?? "#94a3b8" }} />
                    <span className="flex-1 text-muted-foreground">{t.label}</span>
                    <span className="font-semibold tabular-nums">{t.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
