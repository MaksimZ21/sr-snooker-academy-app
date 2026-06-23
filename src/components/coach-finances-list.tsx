"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarX, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayLabelHe } from "@/lib/date";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import { toast } from "sonner";
import type { Session } from "@/lib/sheets/schemas";

/* ── Constants ───────────────────────────────────────────────── */

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

type Mode          = "month" | "year" | "all";
type PayFilter     = "all"   | "paid" | "pending";

const SOURCE_STYLE: Record<string, string> = {
  "מכללה":        "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  "אירוע הכרות":  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
};

/* ── Helpers ─────────────────────────────────────────────────── */

function periodLabel(mode: Mode, year: number, month: number) {
  if (mode === "all")  return "כל הזמן";
  if (mode === "year") return String(year);
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function dateRangeLabel(mode: Mode, year: number, month: number) {
  if (mode !== "month") return null;
  const last = new Date(year, month, 0).getDate();
  const mm   = String(month).padStart(2, "0");
  return `01/${mm} — ${String(last).padStart(2, "0")}/${mm}`;
}

function filterByPeriod(sessions: Session[], mode: Mode, year: number, month: number) {
  if (mode === "all") return sessions;
  if (mode === "year")
    return sessions.filter((s) => s.date.startsWith(String(year)));
  const mm = String(month).padStart(2, "0");
  return sessions.filter((s) => s.date.startsWith(`${year}-${mm}`));
}

function groupByDate(sessions: Session[]) {
  const sorted = [...sessions].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
  });
  const groups: { key: string; sessions: Session[] }[] = [];
  for (const s of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.key === s.date) last.sessions.push(s);
    else groups.push({ key: s.date, sessions: [s] });
  }
  return groups;
}

function groupByMonthKey(sessions: Session[]) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const groups: { key: string; sessions: Session[] }[] = [];
  for (const s of sorted) {
    const key  = s.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.sessions.push(s);
    else groups.push({ key, sessions: [s] });
  }
  return groups;
}

function dateLabel(iso: string) {
  const [, monthStr, dayStr] = iso.split("-");
  return `${dayStr}/${monthStr}`;
}

function monthLabelFromKey(key: string) {
  const [y, m] = key.split("-");
  return `${HEBREW_MONTHS[parseInt(m) - 1]} ${y}`;
}

function payStatus(s: Session): "paid" | "pending" {
  return (s as Session & { payment_status?: string }).payment_status === "paid" ? "paid" : "pending";
}

/* ── Finance session row ─────────────────────────────────────── */

function FinanceRow({
  session,
  onToggle,
  toggling,
}: {
  session: Session;
  onToggle: (id: string, next: "paid" | "pending") => void;
  toggling: boolean;
}) {
  const paid     = payStatus(session) === "paid";
  const typeText = TRAINING_TYPE_LABEL[session.training_type] ?? session.training_type;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors">
      {/* Payment stripe */}
      <div className={cn(
        "w-[3px] self-stretch rounded-full shrink-0",
        paid ? "bg-emerald-500" : "bg-amber-400",
      )} />

      {/* Time */}
      <span className="text-[11px] tabular-nums text-muted-foreground w-10 shrink-0">
        {session.start_time}
      </span>

      {/* Type + source */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className="text-xs font-medium text-foreground/80 shrink-0">{typeText}</span>
        {session.source && session.source !== "אחר" && (
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 h-4 border shrink-0",
              SOURCE_STYLE[session.source] ?? "border-border/60 text-muted-foreground")}
          >
            {session.source}
          </Badge>
        )}
      </div>

      {/* Price */}
      <span className="text-xs font-bold tabular-nums shrink-0">
        {session.price_nis != null ? `${session.price_nis} ₪` : "—"}
      </span>

      {/* Payment toggle */}
      <button
        type="button"
        disabled={toggling}
        onClick={() => onToggle(session.id, paid ? "pending" : "paid")}
        className={cn(
          "shrink-0 flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all duration-150",
          "disabled:opacity-50",
          paid
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
            : "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/30  dark:text-amber-400  dark:border-amber-800",
        )}
      >
        {paid ? <><Check size={10} className="shrink-0" /> שולם</> : "ממתין"}
      </button>
    </div>
  );
}

/* ── Group headers ───────────────────────────────────────────── */

function DateGroupHeader({ date, sessions }: { date: string; sessions: Session[] }) {
  const total    = sessions.reduce((s, r) => s + (r.price_nis ?? 0), 0);
  const dayName  = dayLabelHe(date);
  const shortDt  = dateLabel(date);
  const paidCount = sessions.filter((s) => payStatus(s) === "paid").length;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-y border-border/30 sticky top-0 z-10">
      <span className="text-xs font-bold tabular-nums">{shortDt}</span>
      <span className="text-[10px] text-muted-foreground">{dayName}</span>
      <span className="text-[10px] text-muted-foreground/50 mr-auto">
        {paidCount}/{sessions.length} שולמו
        {total > 0 && ` · ${total.toLocaleString("he-IL")} ₪`}
      </span>
    </div>
  );
}

function MonthGroupHeader({ monthKey, sessions }: { monthKey: string; sessions: Session[] }) {
  const total = sessions.reduce((s, r) => s + (r.price_nis ?? 0), 0);
  const paidCount = sessions.filter((s) => payStatus(s) === "paid").length;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-y border-border/30">
      <span className="text-xs font-semibold">{monthLabelFromKey(monthKey)}</span>
      <span className="text-[10px] text-muted-foreground/60 mr-auto">
        {paidCount}/{sessions.length} שולמו
        {total > 0 && ` · ${total.toLocaleString("he-IL")} ₪`}
      </span>
    </div>
  );
}

/* ── Summary bar ─────────────────────────────────────────────── */

function SummaryBar({ sessions }: { sessions: Session[] }) {
  const paid    = sessions.filter((s) => payStatus(s) === "paid");
  const pending = sessions.filter((s) => payStatus(s) === "pending");
  const paidAmt = paid.reduce((s, r)    => s + (r.price_nis ?? 0), 0);
  const pendAmt = pending.reduce((s, r) => s + (r.price_nis ?? 0), 0);

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20 px-3 py-2.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <Check size={11} />
          <span className="text-[10px] font-medium">שולם</span>
        </div>
        <span className="text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-300 scoreboard-num">
          {paidAmt.toLocaleString("he-IL")} ₪
        </span>
        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500">{paid.length} אימונים</span>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <span className="text-[10px] font-medium">⏳ ממתין לתשלום</span>
        </div>
        <span className="text-sm font-bold tabular-nums text-amber-800 dark:text-amber-300 scoreboard-num">
          {pendAmt.toLocaleString("he-IL")} ₪
        </span>
        <span className="text-[10px] text-amber-600/70 dark:text-amber-500">{pending.length} אימונים</span>
      </div>
    </div>
  );
}

/* ── Filter chips ────────────────────────────────────────────── */

function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider shrink-0">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "text-[11px] px-2.5 py-0.5 rounded-full border transition-all duration-150 font-medium",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function CoachFinancesList({ coachEmail }: { coachEmail?: string }) {
  const now = new Date();
  const [mode, setMode]   = useState<Mode>("month");
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [srcFilter, setSrcFilter]   = useState("all");
  const [payFilter, setPayFilter]   = useState<PayFilter>("all");

  const qc  = useQueryClient();
  const queryKey = ["sessions:mine", coachEmail ?? "me"];
  const url  = coachEmail
    ? `/api/sessions/mine?coach=${encodeURIComponent(coachEmail)}`
    : "/api/sessions/mine";

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[] };
    },
    staleTime: 30_000,
  });

  const { mutate: toggle, variables: toggleVars, isPending: isToggling } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "paid" | "pending" }) => {
      const r = await fetch(`/api/sessions/${id}/payment`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_status: status }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old: { sessions: Session[] } | undefined) => ({
        sessions: (old?.sessions ?? []).map((s) =>
          s.id === id ? { ...s, payment_status: status } : s,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error("שגיאה בעדכון הסטטוס");
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  function prevPeriod() {
    if (mode === "month") {
      if (month === 1) { setMonth(12); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else if (mode === "year") setYear((y) => y - 1);
  }
  function nextPeriod() {
    if (mode === "month") {
      if (month === 12) { setMonth(1); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else if (mode === "year") setYear((y) => y + 1);
  }

  // Filter pipeline
  const byPeriod  = useMemo(() => filterByPeriod(data?.sessions ?? [], mode, year, month), [data, mode, year, month]);
  const bySrc     = useMemo(() => srcFilter === "all" ? byPeriod : byPeriod.filter((s) => s.source === srcFilter), [byPeriod, srcFilter]);
  const filtered  = useMemo(() => payFilter === "all" ? bySrc : bySrc.filter((s) => payStatus(s) === payFilter), [bySrc, payFilter]);

  const sources   = useMemo(() => [...new Set((data?.sessions ?? []).map((s) => s.source).filter(Boolean))], [data]);
  const groups    = useMemo(() => mode === "month" ? groupByDate(filtered) : groupByMonthKey(filtered), [filtered, mode]);

  const label     = periodLabel(mode, year, month);
  const rangeLabel = dateRangeLabel(mode, year, month);

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if ((data?.sessions ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <CalendarX size={40} className="opacity-25" />
        <span className="text-sm">אין מפגשים</span>
      </div>
    );
  }

  const sourceOptions = [
    { value: "all", label: "הכל" },
    ...sources.map((s) => ({ value: s, label: s })),
  ] as { value: string; label: string }[];

  const payOptions: { value: PayFilter; label: string }[] = [
    { value: "all",     label: "הכל" },
    { value: "paid",    label: "שולם" },
    { value: "pending", label: "ממתין" },
  ];

  return (
    <div className="flex flex-col gap-3 p-4">

      {/* Period mode tabs */}
      <div className="bg-muted/60 rounded-xl p-1 flex gap-1">
        {(["all", "year", "month"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 text-sm py-1.5 rounded-lg font-medium transition-all duration-200",
              mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "all" ? "הכל" : m === "year" ? "שנה" : "חודש"}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      {mode !== "all" && (
        <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-3 py-2">
          <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="הבא">
            <ChevronRight size={17} />
          </button>
          <div className="text-center">
            <div className="font-semibold text-sm leading-tight">{label}</div>
            {rangeLabel && <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{rangeLabel}</div>}
          </div>
          <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="הקודם">
            <ChevronLeft size={17} />
          </button>
        </div>
      )}

      {/* Summary: paid vs pending */}
      <SummaryBar sessions={bySrc} />

      {/* Filters */}
      <div className="flex flex-col gap-2 bg-muted/30 rounded-xl px-3 py-2.5">
        {sources.length > 1 && (
          <FilterChips<string>
            label="מקור"
            value={srcFilter}
            options={sourceOptions}
            onChange={setSrcFilter}
          />
        )}
        <FilterChips<PayFilter>
          label="תשלום"
          value={payFilter}
          options={payOptions}
          onChange={setPayFilter}
        />
      </div>

      {/* Sessions */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">אין מפגשים</p>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {groups.map(({ key, sessions: grpSessions }) => (
            <div key={key}>
              {mode === "month"
                ? <DateGroupHeader date={key} sessions={grpSessions} />
                : <MonthGroupHeader monthKey={key} sessions={grpSessions} />}
              <div className="divide-y divide-border/20">
                {grpSessions.map((s) => (
                  <FinanceRow
                    key={s.id}
                    session={s}
                    onToggle={(id, next) => toggle({ id, status: next })}
                    toggling={isToggling && toggleVars?.id === s.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
