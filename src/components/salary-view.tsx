"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Banknote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, CalendarDays, Users, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { trainingTypeBadge } from "@/lib/training-type";
import { dayLabelHe } from "@/lib/date";
import type { SalaryResponse, CoachSalary, SessionDetail } from "@/app/api/admin/salary/route";
import type { TrendResponse } from "@/app/api/admin/salary/trend/route";

const SalaryTrendChart      = dynamic(() => import("@/components/salary-charts").then((m) => m.SalaryTrendChart),      { ssr: false });
const SalaryBreakdownCharts = dynamic(() => import("@/components/salary-charts").then((m) => m.SalaryBreakdownCharts), { ssr: false });

type Mode    = "all" | "year" | "month";
type SortKey = "amount" | "sessions" | "name";

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

const SOURCE_STYLE: Record<string, string> = {
  "מכללה":        "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  "אירוע הכרות":  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
};

const SORT_LABELS: Record<SortKey, string> = {
  amount:   "סכום גבוה",
  sessions: "הכי הרבה אימונים",
  name:     "שם",
};

function periodLabel(mode: Mode, year: number, month: number) {
  if (mode === "all")  return "כל הזמן";
  if (mode === "year") return String(year);
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function apiUrl(mode: Mode, year: number, month: number) {
  if (mode === "all")  return "/api/admin/salary";
  if (mode === "year") return `/api/admin/salary?year=${year}`;
  return `/api/admin/salary?month=${year}-${String(month).padStart(2, "0")}`;
}

function prevApiUrl(mode: Mode, year: number, month: number): string | null {
  if (mode === "all") return null;
  if (mode === "year") return `/api/admin/salary?year=${year - 1}`;
  if (month === 1) return `/api/admin/salary?month=${year - 1}-12`;
  return `/api/admin/salary?month=${year}-${String(month - 1).padStart(2, "0")}`;
}

function currentMonthKey(mode: Mode, year: number, month: number): string | undefined {
  if (mode !== "month") return undefined;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dateRange(mode: Mode, year: number, month: number): string | null {
  if (mode !== "month") return null;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return `01/${mm} — ${String(lastDay).padStart(2, "0")}/${mm}`;
}

/* ── CSV export (session-level with dates) ───────────────────────── */

function exportCsv(data: SalaryResponse, nameMap: Record<string, string>, label: string) {
  const rows = [["תקופה", "מאמן", "תאריך", "יום", "סוג אימון", "מקור", "סכום (₪)"]];
  for (const coach of data.coaches) {
    const name = nameMap[coach.email] ?? coach.email;
    for (const s of coach.sessions) {
      const day = dayLabelHe(s.date);
      rows.push([label, name, s.date, day, s.training_type, s.source, String(s.price_nis)]);
    }
  }
  const csv  = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `expenses-${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Delta badge ──────────────────────────────────────────────── */

function DeltaBadge({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === null) return null;
  if (prev === 0) return <span className="text-[10px] text-muted-foreground font-medium">אין השוואה</span>;
  const pct = Math.round(((current - prev) / prev) * 100);
  const up  = pct >= 0;
  return (
    <span className={cn(
      "flex items-center gap-0.5 text-[11px] font-semibold",
      up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400",
    )}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

/* ── Stat cards ───────────────────────────────────────────────── */

function StatCards({
  data, prevData, isLoading,
}: {
  data: SalaryResponse | undefined;
  prevData: SalaryResponse | undefined;
  isLoading: boolean;
}) {
  const cards = [
    {
      icon:      <Banknote size={16} />,
      label:     "סה\"כ הוצאות",
      value:     data?.grand_total,
      prevValue: prevData?.grand_total,
      format:    (v: number) => `${v.toLocaleString("he-IL")} ₪`,
    },
    {
      icon:      <CalendarDays size={16} />,
      label:     "אימונים",
      value:     data?.session_count,
      prevValue: prevData?.session_count,
      format:    (v: number) => String(v),
    },
    {
      icon:      <Users size={16} />,
      label:     "מאמנים פעילים",
      value:     data?.coach_count,
      prevValue: prevData?.coach_count,
      format:    (v: number) => String(v),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-card border border-border/60 rounded-xl px-3.5 py-3 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{card.icon}</span>
            {!isLoading && card.value !== undefined && card.prevValue !== undefined && (
              <DeltaBadge current={card.value} prev={card.prevValue} />
            )}
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-20 mt-1" />
              <Skeleton className="h-3 w-14" />
            </>
          ) : (
            <>
              <span className="text-xl font-bold tabular-nums scoreboard-num leading-none">
                {card.value !== undefined ? card.format(card.value) : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">{card.label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Session detail row ───────────────────────────────────────── */

function SessionDetailRow({ session }: { session: SessionDetail }) {
  const { label: typeLabel, className: typeCls } = trainingTypeBadge(session.training_type);
  const [monthStr, dayStr] = session.date.slice(5).split("-");
  const shortDate = `${dayStr}/${monthStr}`;
  const dayName   = dayLabelHe(session.date);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
      {/* Date */}
      <div className="shrink-0 w-16 text-right">
        <div className="text-xs font-semibold tabular-nums">{shortDate}</div>
        <div className="text-[10px] text-muted-foreground">{dayName}</div>
      </div>

      {/* Badges */}
      <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-[18px] border shrink-0", typeCls)}>
          {typeLabel}
        </Badge>
        {session.source !== "אחר" && (
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 h-[18px] border shrink-0",
              SOURCE_STYLE[session.source] ?? "bg-muted text-muted-foreground")}
          >
            {session.source}
          </Badge>
        )}
      </div>

      {/* Price */}
      <span className="text-sm font-semibold tabular-nums shrink-0">
        {session.price_nis > 0 ? `${session.price_nis.toLocaleString("he-IL")} ₪` : "—"}
      </span>
    </div>
  );
}

/* ── Coach card ───────────────────────────────────────────────── */

function CoachRow({ coach, nameMap, rank }: {
  coach: CoachSalary;
  nameMap: Record<string, string>;
  rank: number;
}) {
  const [open, setOpen] = useState(false);
  const name = nameMap[coach.email] ?? coach.email;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
      {/* Summary header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-right"
      >
        <span className="text-xs font-bold text-muted-foreground/40 w-5 text-center shrink-0 tabular-nums">
          {rank}
        </span>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-semibold text-sm leading-tight truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{coach.email}</p>
          {/* Source breakdown pills */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {coach.rows.map((r) => (
              <Badge
                key={r.source}
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 h-4 border",
                  SOURCE_STYLE[r.source] ?? "bg-muted text-muted-foreground")}
              >
                {r.count} {r.source}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="font-bold text-base tabular-nums leading-tight">
              {coach.amount_total.toLocaleString("he-IL")} ₪
            </p>
            <p className="text-xs text-muted-foreground">{coach.sessions_total} אימונים</p>
          </div>
          {open
            ? <ChevronUp size={15} className="text-muted-foreground" />
            : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Session list */}
      {open && (
        <div className="border-t border-border/40">
          {/* Source summary bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/20 border-b border-border/30 flex-wrap">
            {coach.rows.map((row) => (
              <div key={row.source} className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("text-xs border", SOURCE_STYLE[row.source] ?? "bg-muted text-muted-foreground")}
                >
                  {row.source}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {row.count} × {row.count > 0 ? Math.round(row.total_nis / row.count).toLocaleString("he-IL") : 0} ₪
                  <span className="text-muted-foreground/60 mx-1">·</span>
                  {row.total_nis.toLocaleString("he-IL")} ₪
                </span>
              </div>
            ))}
          </div>

          {/* Individual sessions */}
          <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
            {coach.sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">אין נתונים</p>
            ) : (
              coach.sessions.map((s) => <SessionDetailRow key={s.id} session={s} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SalaryView ───────────────────────────────────────────────── */

export function SalaryView() {
  const now = new Date();
  const [mode, setMode]     = useState<Mode>("month");
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [sortBy, setSortBy] = useState<SortKey>("amount");

  function prev() {
    if (mode === "month") {
      if (month === 1) { setMonth(12); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else if (mode === "year") {
      setYear((y) => y - 1);
    }
  }

  function next() {
    if (mode === "month") {
      if (month === 12) { setMonth(1); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else if (mode === "year") {
      setYear((y) => y + 1);
    }
  }

  const url        = apiUrl(mode, year, month);
  const prevUrl    = prevApiUrl(mode, year, month);
  const label      = periodLabel(mode, year, month);
  const rangeLabel = dateRange(mode, year, month);

  const { data, isLoading } = useQuery<SalaryResponse>({
    queryKey: ["salary", mode, year, month],
    queryFn:  async () => { const r = await fetch(url); if (!r.ok) throw new Error("fetch failed"); return r.json(); },
    staleTime: 30_000,
  });

  const { data: prevData } = useQuery<SalaryResponse>({
    queryKey: ["salary-prev", mode, year, month],
    queryFn:  async () => { const r = await fetch(prevUrl!); if (!r.ok) throw new Error("fetch failed"); return r.json(); },
    staleTime: 60_000,
    enabled:  !!prevUrl,
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<TrendResponse>({
    queryKey: ["salary-trend"],
    queryFn:  async () => { const r = await fetch("/api/admin/salary/trend"); if (!r.ok) throw new Error("fetch failed"); return r.json(); },
    staleTime: 300_000,
  });

  const { data: coachesData } = useQuery({
    queryKey: ["coaches:all"],
    queryFn:  async () => { const r = await fetch("/api/coaches"); if (!r.ok) throw new Error("fetch failed"); return r.json() as Promise<{ coaches: { email: string; name: string }[] }>; },
    staleTime: 300_000,
  });

  const nameMap: Record<string, string> = {};
  for (const c of coachesData?.coaches ?? []) nameMap[c.email] = c.name;

  const sorted = useMemo(() => {
    const list = [...(data?.coaches ?? [])];
    if (sortBy === "amount")   return list.sort((a, b) => b.amount_total - a.amount_total);
    if (sortBy === "sessions") return list.sort((a, b) => b.sessions_total - a.sessions_total);
    if (sortBy === "name")     return list.sort((a, b) => (nameMap[a.email] ?? "").localeCompare(nameMap[b.email] ?? "", "he"));
    return list;
  }, [data, sortBy, nameMap]);

  return (
    <div className="p-4 flex flex-col gap-4">

      {/* Period mode selector */}
      <div className="bg-muted/60 rounded-xl p-1 flex gap-1">
        {(["all", "year", "month"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 text-sm py-1.5 rounded-lg font-medium transition-all duration-200",
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "all" ? "כל הזמן" : m === "year" ? "שנה" : "חודש"}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      {mode !== "all" && (
        <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-3 py-2.5">
          <button
            onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="הבא"
          >
            <ChevronRight size={18} />
          </button>
          <div className="text-center">
            <div className="font-semibold text-sm leading-tight">{label}</div>
            {rangeLabel && (
              <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{rangeLabel}</div>
            )}
          </div>
          <button
            onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="הקודם"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <StatCards data={data} prevData={mode !== "all" ? prevData : undefined} isLoading={isLoading} />

      {/* Trend chart */}
      <SalaryTrendChart
        months={trendData?.months}
        isLoading={trendLoading}
        currentMonth={currentMonthKey(mode, year, month)}
      />

      {/* Breakdown charts */}
      <SalaryBreakdownCharts data={data} isLoading={isLoading} />

      {/* Sort + Export */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="text-xs border border-border/60 rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          {data && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => exportCsv(data, nameMap, label)}
            >
              <Download size={12} />
              ייצוא CSV
            </Button>
          )}
        </div>
      </div>

      {/* Coaches list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">אין נתונים לתקופה זו</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((coach, i) => (
            <CoachRow key={coach.email} coach={coach} nameMap={nameMap} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
