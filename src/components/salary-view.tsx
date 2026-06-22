"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Banknote, ChevronDown, ChevronUp, ArrowDownUp } from "lucide-react";
import type { SalaryResponse, CoachSalary } from "@/app/api/admin/salary/route";

type SortKey = "amount" | "sessions" | "name";

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2026, i, 1);
  return {
    value: `2026-${String(i + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
  };
}).reverse();

const SOURCE_STYLE: Record<string, string> = {
  "מכללה": "bg-blue-100 text-blue-700 border-blue-200",
  "אירוע הכרות": "bg-amber-100 text-amber-700 border-amber-200",
};

const SORT_LABELS: Record<SortKey, string> = {
  amount: "סכום גבוה",
  sessions: "הכי הרבה אימונים",
  name: "שם",
};

function CoachRow({
  coach,
  nameMap,
  rank,
}: {
  coach: CoachSalary;
  nameMap: Record<string, string>;
  rank: number;
}) {
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
                className={`text-[10px] px-1.5 py-0 h-4 border ${SOURCE_STYLE[r.source] ?? "bg-muted text-muted-foreground"}`}
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
          {open ? (
            <ChevronUp size={15} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={15} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {coach.rows.map((row) => (
            <div
              key={row.source}
              className="flex items-center justify-between px-5 py-2.5 bg-muted/20"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs border ${SOURCE_STYLE[row.source] ?? "bg-muted text-muted-foreground"}`}
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

export function SalaryView() {
  const currentMonth = `2026-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [sortBy, setSortBy] = useState<SortKey>("amount");

  const { data, isLoading } = useQuery({
    queryKey: ["salary", month],
    queryFn: async () => {
      const r = await fetch(`/api/admin/salary?month=${month}`);
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
    if (sortBy === "amount") return list.sort((a, b) => b.amount_total - a.amount_total);
    if (sortBy === "sessions") return list.sort((a, b) => b.sessions_total - a.sessions_total);
    if (sortBy === "name")
      return list.sort((a, b) =>
        (nameMap[a.email] ?? a.email).localeCompare(nameMap[b.email] ?? b.email, "he"),
      );
    return list;
  }, [data, sortBy, nameMap]);

  // Breakdown by source
  const sourceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const coach of data?.coaches ?? []) {
      for (const row of coach.rows) {
        map[row.source] = (map[row.source] ?? 0) + row.total_nis;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Controls */}
      <div className="flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="מיין לפי"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Total card */}
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
            {sourceBreakdown.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {sourceBreakdown.map(([source, total]) => (
                  <div
                    key={source}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${SOURCE_STYLE[source] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    <span>{source}</span>
                    <span className="tabular-nums">{total.toLocaleString("he-IL")} ₪</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coaches list */}
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">אין נתונים לחודש זה</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((coach, i) => (
                <CoachRow
                  key={coach.email}
                  coach={coach}
                  nameMap={nameMap}
                  rank={i + 1}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
