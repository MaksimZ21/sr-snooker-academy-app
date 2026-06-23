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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import type { TrendMonth } from "@/app/api/admin/salary/trend/route";
import type { SalaryResponse } from "@/app/api/admin/salary/route";

// Snooker ball color palette for charts
const BALL_COLORS = [
  "#1a7a4a", // green (baize)
  "#2980b9", // blue
  "#c0392b", // red
  "#e91e8c", // pink
  "#d4a017", // yellow
  "#78716c", // brown/stone
];

const SOURCE_COLORS: Record<string, string> = {
  "מכללה":       "#2980b9",
  "אירוע הכרות": "#d4a017",
  "אחר":         "#78716c",
};

const TYPE_COLORS: Record<string, string> = {
  private:      "#c0392b",
  group:        "#2980b9",
  beginners:    "#d4a017",
  advanced:     "#e91e8c",
  technique:    "#78716c",
  "match-play": "#1a7a4a",
};

function shekelFormatter(v: number) {
  if (v >= 1000) return `₪${(v / 1000).toFixed(0)}k`;
  return `₪${v}`;
}

/* ── Trend chart ──────────────────────────────────────────────── */

export function SalaryTrendChart({
  months,
  isLoading,
  currentMonth,
}: {
  months: TrendMonth[] | undefined;
  isLoading: boolean;
  currentMonth?: string; // YYYY-MM to highlight
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">מגמת הוצאות על מאמנים — 12 חודשים אחרונים</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading || !months ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={months} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={shekelFormatter}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString("he-IL")} ₪`, "הוצאות"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.label ?? label}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  color: "var(--color-card-foreground)",
                }}
                cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {months.map((m) => (
                  <Cell
                    key={m.month}
                    fill={m.month === currentMonth ? "var(--color-primary)" : "oklch(0.52 0.22 145 / 0.35)"}
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

/* ── Source pie chart ─────────────────────────────────────────── */

function SourcePie({ data }: { data: SalaryResponse["by_source"] }) {
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="source"
          cx="50%"
          cy="50%"
          outerRadius={56}
          innerRadius={30}
        >
          {data.map((entry, i) => (
            <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] ?? BALL_COLORS[i % BALL_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [
            `${Number(v).toLocaleString("he-IL")} ₪ (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}%)`,
            "",
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            color: "var(--color-card-foreground)",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Training type bar chart ──────────────────────────────────── */

function TypeBar({ data }: { data: SalaryResponse["by_training_type"] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: TRAINING_TYPE_LABEL[d.type] ?? d.type,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tickFormatter={shekelFormatter}
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toLocaleString("he-IL")} ₪`, "הוצאות"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            color: "var(--color-card-foreground)",
          }}
        />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell
              key={entry.type}
              fill={TYPE_COLORS[entry.type] ?? BALL_COLORS[i % BALL_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Combined breakdown row ───────────────────────────────────── */

export function SalaryBreakdownCharts({
  data,
  isLoading,
}: {
  data: SalaryResponse | undefined;
  isLoading: boolean;
}) {
  const hasSource = (data?.by_source?.length ?? 0) > 0;
  const hasType   = (data?.by_training_type?.length ?? 0) > 0;

  if (!hasSource && !hasType && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">לפי מקור</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading || !data ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : hasSource ? (
            <SourcePie data={data.by_source} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-14">אין נתונים</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">לפי סוג אימון</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading || !data ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : hasType ? (
            <TypeBar data={data.by_training_type} />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-14">אין נתונים</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
