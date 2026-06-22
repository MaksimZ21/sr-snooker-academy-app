"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Banknote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalaryResponse, CoachSalary } from "@/app/api/admin/salary/route";

type Mode = "all" | "year" | "month";
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
  if (mode === "all")   return "כל הזמן";
  if (mode === "year")  return String(year);
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function apiUrl(mode: Mode, year: number, month: number) {
  if (mode === "all")   return "/api/admin/salary";
  if (mode === "year")  return `/api/admin/salary?year=${year}`;
  return `/api/admin/salary?month=${year}-${String(month).padStart(2, "0")}`;
}

function queryKey(mode: Mode, year: number, month: number) {
  return ["salary", mode, year, month];
}

/* ─── CoachRow ──────────────────────────────────────────────── */

function CoachRow({ coach, nameMap, rank }: { coach: CoachSalary; nameMap: Record<string, string>; rank: number }) {
  const [open, setOpen] = useState(false);
  const name = nameMap[coach.email] ?? coach.email;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
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
          <div className="flex flex-wrap gap-1 mt-1">
            {coach.rows.map((r) => (
              <Badge
                key={r.source}
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0 h-4 border", SOURCE_STYLE[r.source] ?? "bg-muted text-muted-foreground")}
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

      {open && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {coach.rows.map((row) => (
            <div key={row.source} className="flex items-center justify-between px-5 py-2.5 bg-muted/20">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs border", SOURCE_STYLE[row.source] ?? "bg-muted text-muted-foreground")}
                >
                  {row.source}
                </Badge>
                <span className="text-sm text-muted-foreground">{row.count} אימונים</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {row.total_nis.toLocaleString("he-IL")} ₪
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SalaryView ─────────────────────────────────────────────── */

export function SalaryView() {
  const now = new Date();
  const [mode, setMode]   = useState<Mode>("month");
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
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

  const url = apiUrl(mode, year, month);
  const key = queryKey(mode, year, month);

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as SalaryResponse;
    },
    staleTime: 30_000,
  });

  const { data: coachesData } = useQuery({
    queryKey: ["coaches:all"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: { email: string; name: string }[] };
    },
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

  const label = periodLabel(mode, year, month);

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

      {/* Period navigation (month / year only) */}
      {mode !== "all" && (
        <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-3 py-2.5">
          <button
            onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="הבא"
          >
            <ChevronRight size={18} />
          </button>
          <span className="font-semibold text-sm">{label}</span>
          <button
            onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="הקודם"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {mode === "all" ? "כל הזמן" : label}
        </span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="text-xs border border-border/60 rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Banknote size={16} className="text-primary" />
                סה&quot;כ לתשלום
              </div>
              <span className="text-2xl font-bold tabular-nums text-primary">
                {(data?.grand_total ?? 0).toLocaleString("he-IL")} ₪
              </span>
            </div>
            {(data?.by_source ?? []).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {data!.by_source.map(({ source, total }) => (
                  <div
                    key={source}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
                      SOURCE_STYLE[source] ?? "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    <span>{source}</span>
                    <span className="tabular-nums">{total.toLocaleString("he-IL")} ₪</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coaches */}
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">אין נתונים לתקופה זו</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((coach, i) => (
                <CoachRow key={coach.email} coach={coach} nameMap={nameMap} rank={i + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
