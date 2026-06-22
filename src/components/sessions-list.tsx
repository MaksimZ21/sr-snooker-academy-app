"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SessionCard } from "./session-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/lib/sheets/schemas";
import { CalendarX } from "lucide-react";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

type SortKey = "date-desc" | "date-asc" | "amount-desc";
type SourceFilter = "all" | "מכללה" | "אירוע הכרות";

const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "חדש לישן",
  "date-asc": "ישן לחדש",
  "amount-desc": "סכום גבוה",
};

function monthLabel(yyyyMm: string) {
  const [year, month] = yyyyMm.split("-");
  return `${HEBREW_MONTHS[parseInt(month) - 1]} ${year}`;
}

function groupByMonth(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function SessionsList({
  basePath,
  coachEmail,
}: {
  basePath: "coach" | "admin";
  coachEmail?: string;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const queryKey = ["sessions:mine", coachEmail ?? "me"];
  const url = coachEmail
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

  const filtered = useMemo(() => {
    let list = data?.sessions ?? [];
    if (sourceFilter !== "all") list = list.filter((s) => s.source === sourceFilter);
    return list;
  }, [data, sourceFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "date-desc") return list.sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === "date-asc") return list.sort((a, b) => a.date.localeCompare(b.date));
    if (sortBy === "amount-desc") return list.sort((a, b) => (b.price_nis ?? 0) - (a.price_nis ?? 0));
    return list;
  }, [filtered, sortBy]);

  const grouped = useMemo(() => {
    if (sortBy === "amount-desc") {
      // When sorting by amount, show one flat group
      return [["הכל", sorted] as [string, Session[]]];
    }
    return groupByMonth(sorted);
  }, [sorted, sortBy]);

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </section>
        ))}
      </div>
    );
  }

  const total = filtered.length;
  const grandTotal = filtered.reduce((s, r) => s + (r.price_nis ?? 0), 0);

  // Sources present in data
  const sources = Array.from(new Set((data?.sessions ?? []).map((s) => s.source).filter(Boolean)));

  if ((data?.sessions ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <CalendarX size={42} className="opacity-25" />
        <span className="text-sm">אין מפגשים</span>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Controls */}
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>

        {sources.length > 1 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">הכל</option>
            {sources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Totals */}
      <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
        <p className="text-xs text-muted-foreground">{total} מפגשים</p>
        {grandTotal > 0 && (
          <p className="text-xs font-semibold tabular-nums">{grandTotal.toLocaleString("he-IL")} ₪</p>
        )}
      </div>

      {/* Sessions grouped */}
      <div className="flex flex-col gap-6">
        {grouped.map(([key, sessions]) => {
          const monthTotal = sessions.reduce((s, r) => s + (r.price_nis ?? 0), 0);
          const label = key === "הכל" ? null : monthLabel(key);
          return (
            <section key={key} className="flex flex-col gap-2">
              {label && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">{label}</h2>
                    <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full">
                      {sessions.length}
                    </span>
                  </div>
                  {monthTotal > 0 && (
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {monthTotal.toLocaleString("he-IL")} ₪
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <SessionCard key={s.id} session={s} basePath={basePath} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
