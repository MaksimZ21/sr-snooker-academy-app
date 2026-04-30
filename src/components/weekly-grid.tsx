"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { SessionCard } from "./session-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/lib/sheets/schemas";

export function WeeklyGrid({
  basePath,
  coachFilter,
}: {
  basePath: "coach" | "admin";
  coachFilter?: string;
}) {
  const [anchor, setAnchor] = useState(todayIsoTel());
  const { startIso, endIso } = weekRangeFor(anchor);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions:week", startIso, endIso, coachFilter ?? null],
    queryFn: async () => {
      const url = new URL("/api/sessions/week", window.location.origin);
      url.searchParams.set("start", startIso);
      url.searchParams.set("end", endIso);
      if (coachFilter) url.searchParams.set("coach", coachFilter);
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[] };
    },
    refetchInterval: basePath === "admin" ? 30_000 : 60_000,
  });

  const days = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(startIso), i), "yyyy-MM-dd"),
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => setAnchor(format(addDays(parseISO(anchor), -7), "yyyy-MM-dd"))}>
          ←
        </Button>
        <Button variant="ghost" onClick={() => setAnchor(todayIsoTel())}>
          היום
        </Button>
        <Button onClick={() => setAnchor(format(addDays(parseISO(anchor), 7), "yyyy-MM-dd"))}>
          →
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((iso) => {
          const ses = (data?.sessions ?? []).filter((s) => s.date === iso);
          return (
            <div key={iso} className="flex flex-col gap-2">
              <div className="font-semibold text-sm">{dayLabelHe(iso)}</div>
              <div className="text-xs text-muted-foreground">
                {iso.slice(8, 10)}.{iso.slice(5, 7)}
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </>
              ) : (
                <>
                  {ses.length === 0 && (
                    <div className="text-xs text-muted-foreground">—</div>
                  )}
                  {ses.map((s) => (
                    <SessionCard key={s.id} session={s} basePath={basePath} />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
