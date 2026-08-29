"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Banknote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, CalendarDays, Users, Download, Minus, Plus, Trash2,
  FileText, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { dayLabelHe } from "@/lib/date";
import { toast } from "sonner";
import type { SalaryResponse, CoachSalary, SessionDetail, OffsetEntry } from "@/app/api/admin/salary/route";
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

/* ── Session row (no date — date shown as group header) ──────── */

function SessionRow({ session }: { session: SessionDetail }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2 hover:bg-muted/20 transition-colors">
      <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
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
      <span className="text-sm font-semibold tabular-nums shrink-0">
        {session.price_nis > 0 ? `${session.price_nis.toLocaleString("he-IL")} ₪` : "—"}
      </span>
    </div>
  );
}

/* ── Group sessions by date ───────────────────────────────────── */

function SessionsByDate({ sessions }: { sessions: SessionDetail[] }) {
  const groups: { date: string; sessions: SessionDetail[] }[] = [];
  for (const s of sessions) {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) {
      last.sessions.push(s);
    } else {
      groups.push({ date: s.date, sessions: [s] });
    }
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      {groups.map(({ date, sessions: daySessions }) => {
        const [monthStr, dayStr] = date.slice(5).split("-");
        const shortDate = `${dayStr}/${monthStr}`;
        const dayName   = dayLabelHe(date);
        const dayTotal  = daySessions.reduce((s, r) => s + r.price_nis, 0);

        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/40 border-y border-border/30 sticky top-0 z-10">
              <span className="text-xs font-bold tabular-nums">{shortDate}</span>
              <span className="text-[10px] text-muted-foreground">{dayName}</span>
              {daySessions.length > 1 && (
                <span className="text-[10px] text-muted-foreground/60 mr-auto">
                  {daySessions.length} אימונים · {dayTotal.toLocaleString("he-IL")} ₪
                </span>
              )}
            </div>
            {/* Sessions */}
            <div className="divide-y divide-border/20">
              {daySessions.map((s) => <SessionRow key={s.id} session={s} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Offsets section ──────────────────────────────────────────── */

function OffsetsSection({ coach, queryKey, currentMonth }: { coach: CoachSalary; queryKey: unknown[]; currentMonth: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function addOffset() {
    const num = parseFloat(amount);
    if (!desc.trim() || isNaN(num) || num <= 0) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/offsets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coach_email: coach.email, amount: num, description: desc.trim(), month }),
      });
      if (!r.ok) throw new Error();
      await qc.invalidateQueries({ queryKey });
      setDesc(""); setAmount(""); setMonth(currentMonth); setAdding(false);
      toast.success("קיזוז נוסף");
    } catch {
      toast.error("שגיאה בהוספת קיזוז");
    } finally {
      setSaving(false);
    }
  }

  async function removeOffset(id: string) {
    setDeletingId(id);
    try {
      const r = await fetch("/api/admin/offsets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coach_email: coach.email, id }),
      });
      if (!r.ok) throw new Error();
      await qc.invalidateQueries({ queryKey });
      toast.success("קיזוז הוסר");
    } catch {
      toast.error("שגיאה בהסרת קיזוז");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="border-t border-border/40 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Minus size={12} /> קיזוזים
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={12} /> הוסף
          </button>
        )}
      </div>

      {/* Existing offsets */}
      {coach.offsets.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground/60 text-center py-1">אין קיזוזים</p>
      )}
      {coach.offsets.map((o) => (
        <div key={o.id} className="flex items-center gap-2 text-sm">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">{o.month}</span>
          <span className="flex-1 text-muted-foreground truncate">{o.description}</span>
          <span className="tabular-nums font-medium text-rose-600 shrink-0">
            -{o.amount.toLocaleString("he-IL")} ₪
          </span>
          <button
            onClick={() => removeOffset(o.id)}
            disabled={deletingId === o.id}
            className="text-muted-foreground/40 hover:text-rose-500 transition-colors disabled:opacity-30"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add form */}
      {adding && (
        <div className="flex flex-col gap-2 pt-1">
          <Input
            autoFocus
            placeholder="תיאור (לדוג׳: החזר על ציוד)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="h-8 text-sm"
            dir="rtl"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="סכום ₪"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 text-sm w-24 tabular-nums"
              min="0"
            />
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 text-sm w-32 tabular-nums"
            />
            <Button size="sm" className="h-8 text-xs flex-1" disabled={saving} onClick={addOffset}>
              {saving ? "שומר..." : "הוסף"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAdding(false); setDesc(""); setAmount(""); setMonth(currentMonth); }}>
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Summary row */}
      {(coach.offsets.length > 0 || coach.amount_total > 0) && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-1">
          <span className="text-xs text-muted-foreground">
            גרוס {coach.amount_total.toLocaleString("he-IL")} ₪
            {coach.offsets_total > 0 && (
              <> · קיזוזים -{coach.offsets_total.toLocaleString("he-IL")} ₪</>
            )}
          </span>
          <span className="text-sm font-bold tabular-nums">
            {coach.net_total.toLocaleString("he-IL")} ₪
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Send PDF button ──────────────────────────────────────────── */

function SendSalaryPdfButton({ email, month }: { email: string; month: string }) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const toastId = toast.loading("שולח PDF...");
    try {
      const r = await fetch(`/api/admin/salary/${encodeURIComponent(email)}/send-pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשליחת ה-PDF");
      }
      toast.success("ה-PDF נשלח למאמן", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשליחת ה-PDF", { id: toastId });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border/40 px-4 py-3 flex justify-end">
      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={sending} onClick={send}>
        {sending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
        {sending ? "שולח..." : "הפקת ושליחת PDF למאמן"}
      </Button>
    </div>
  );
}

/* ── Coach card ───────────────────────────────────────────────── */

function CoachRow({ coach, nameMap, rank, queryKey, currentMonth, monthMode }: {
  coach: CoachSalary;
  nameMap: Record<string, string>;
  rank: number;
  queryKey: unknown[];
  currentMonth: string;
  monthMode: boolean;
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

          {/* Individual sessions grouped by date */}
          {coach.sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">אין נתונים</p>
          ) : (
            <SessionsByDate sessions={coach.sessions} />
          )}

          {/* Offsets */}
          <OffsetsSection coach={coach} queryKey={queryKey} currentMonth={currentMonth} />

          {/* Send PDF */}
          {monthMode && <SendSalaryPdfButton email={coach.email} month={currentMonth} />}
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
            <CoachRow
              key={coach.email}
              coach={coach}
              nameMap={nameMap}
              rank={i + 1}
              queryKey={["salary", mode, year, month]}
              currentMonth={mode === "month" ? `${year}-${String(month).padStart(2, "0")}` : `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              monthMode={mode === "month"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
