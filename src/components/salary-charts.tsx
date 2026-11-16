"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import { TYPE_COLORS } from "@/components/broadcast";
import { cn } from "@/lib/utils";
import type { TrendMonth } from "@/app/api/admin/salary/trend/route";
import type { SalaryResponse } from "@/app/api/admin/salary/route";

// Snooker ball colors for anything without its own color.
const BALL_COLORS = ["#1a7a4a", "#2980b9", "#c0392b", "#e91e8c", "#d4a017", "#78716c"];

const SOURCE_COLORS: Record<string, string> = {
  "מכללה": "#2980b9",
  "אירוע הכרות": "#d4a017",
  "אחר": "#78716c",
};

function shekelShort(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(v);
}

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card border rounded-[18px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b">
        <h2 className="font-display font-extrabold text-base">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ── Trend: twelve months as scoreboard bars ──────────────────── */

export function SalaryTrendChart({
  months,
  isLoading,
  currentMonth,
}: {
  months: TrendMonth[] | undefined;
  isLoading: boolean;
  currentMonth?: string; // YYYY-MM to highlight
}) {
  const max = Math.max(1, ...(months ?? []).map((m) => m.total));
  return (
    <Panel title="הוצאות על מאמנים · 12 חודשים">
      {isLoading || !months ? (
        <Skeleton className="h-48 m-4 rounded-lg" />
      ) : (
        <div className="flex items-end gap-1.5 md:gap-2.5 h-52 px-[18px] pt-8 pb-3 overflow-x-auto">
          {months.map((m, i) => {
            const current = m.month === currentMonth;
            return (
              <div key={m.month} className="flex-1 min-w-7 h-full flex flex-col items-center justify-end gap-2" title={`${m.label}: ${m.total.toLocaleString("he-IL")} ₪`}>
                <div
                  className={cn("w-full rounded-md relative bc-grow", current ? "bc-bar-today" : "bg-muted dark:bg-white/10")}
                  style={{ height: `${Math.max(2, (m.total / max) * 86)}%`, animationDelay: `${0.1 + i * 0.04}s` }}
                >
                  {m.total > 0 && (
                    <span className={cn("absolute -top-5 inset-x-0 text-center font-display font-extrabold text-[11px]", current ? "text-primary" : "text-muted-foreground")}>
                      {shekelShort(m.total)}
                    </span>
                  )}
                </div>
                <span className={cn("font-display font-bold text-[11px]", current ? "text-primary" : "text-muted-foreground")}>{m.shortLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ── Breakdown: one ranked list of bars per split ─────────────── */

function RankedBars({ rows }: { rows: { key: string; label: string; total: number; color: string }[] }) {
  const sum = rows.reduce((n, r) => n + r.total, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="flex flex-col gap-3 p-[18px]">
      {[...rows].sort((a, b) => b.total - a.total).map((r) => (
        <div key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="bc-num text-lg leading-none">{r.total.toLocaleString("he-IL")} ₪</span>
              <span className="text-xs text-muted-foreground tabular-nums w-9 text-start">{Math.round((r.total / sum) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalaryBreakdownCharts({
  data,
  isLoading,
}: {
  data: SalaryResponse | undefined;
  isLoading: boolean;
}) {
  const hasSource = (data?.by_source?.length ?? 0) > 0;
  const hasType = (data?.by_training_type?.length ?? 0) > 0;

  if (!hasSource && !hasType && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <Panel title="לפי מקור">
        {isLoading || !data ? (
          <Skeleton className="h-32 m-4 rounded-lg" />
        ) : hasSource ? (
          <RankedBars
            rows={data.by_source.map((d, i) => ({
              key: d.source,
              label: d.source,
              total: d.total,
              color: SOURCE_COLORS[d.source] ?? BALL_COLORS[i % BALL_COLORS.length],
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">אין נתונים</p>
        )}
      </Panel>
      <Panel title="לפי סוג אימון">
        {isLoading || !data ? (
          <Skeleton className="h-32 m-4 rounded-lg" />
        ) : hasType ? (
          <RankedBars
            rows={data.by_training_type.map((d, i) => ({
              key: d.type,
              label: TRAINING_TYPE_LABEL[d.type] ?? d.type,
              total: d.total,
              color: TYPE_COLORS[d.type] ?? BALL_COLORS[i % BALL_COLORS.length],
            }))}
          />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">אין נתונים</p>
        )}
      </Panel>
    </div>
  );
}
