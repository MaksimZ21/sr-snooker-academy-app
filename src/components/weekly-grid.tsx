"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SessionCard } from "./session-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";

export function WeeklyGrid({
  basePath,
  coachFilter,
}: {
  basePath: "coach" | "admin";
  coachFilter?: string;
}) {
  const [anchor, setAnchor] = useState(todayIsoTel());
  const today = todayIsoTel();
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

  const startDisplay = `${startIso.slice(8, 10)}.${startIso.slice(5, 7)}`;
  const endDisplay = `${endIso.slice(8, 10)}.${endIso.slice(5, 7)}`;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(format(addDays(parseISO(anchor), -7), "yyyy-MM-dd"))}
          className="flex items-center gap-1"
        >
          <ChevronRight size={16} />
          <span className="hidden sm:inline">שבוע קודם</span>
        </Button>

        <div className="flex flex-col items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnchor(todayIsoTel())}
            className="font-medium text-sm"
          >
            היום
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {startDisplay} – {endDisplay}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAnchor(format(addDays(parseISO(anchor), 7), "yyyy-MM-dd"))}
          className="flex items-center gap-1"
        >
          <span className="hidden sm:inline">שבוע הבא</span>
          <ChevronLeft size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((iso) => {
          const ses = (data?.sessions ?? []).filter((s) => s.date === iso);
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={cn(
                "flex flex-col gap-2 rounded-xl p-2 transition-colors",
                isToday && "bg-primary/5 ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <div className={cn("font-semibold text-sm", isToday && "text-primary")}>
                  {dayLabelHe(iso)}
                </div>
                <div className={cn("text-xs tabular-nums", isToday ? "text-primary/70" : "text-muted-foreground")}>
                  {iso.slice(8, 10)}.{iso.slice(5, 7)}
                </div>
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </>
              ) : (
                <>
                  {ses.length === 0 && (
                    <div className="text-xs text-muted-foreground/50 text-center py-2">—</div>
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
