"use client";
import { useState } from "react";
import { DayColumns } from "@/components/day-strip";
import { MatchLine } from "@/components/match-line";
import { weekRangeFor } from "@/lib/date";
import { WeekScheduleNav, defaultWeekStart } from "@/components/week-schedule-nav";

export type PublicScheduleRow = {
  id: string;
  date: string;
  nameA: string;
  nameB: string;
  framesA: number | null;
  framesB: number | null;
  sub?: string;
};

// The public league schedule, one week at a time.
export function PublicWeekSchedule({ rows }: { rows: PublicScheduleRow[] }) {
  const days = [...new Set(rows.map((r) => r.date))].sort();
  const [weekStart, setWeekStart] = useState(() => defaultWeekStart(days));
  const { endIso } = weekRangeFor(weekStart);
  const weekDays = days.filter((d) => d >= weekStart && d <= endIso);
  const weekRows = rows.filter((r) => r.date >= weekStart && r.date <= endIso);

  return (
    <div className="px-4 py-3">
      <WeekScheduleNav startIso={weekStart} count={weekRows.length} onChange={setWeekStart} />
      {weekDays.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">אין משחקים משובצים בשבוע הזה</p>
      ) : (
        <DayColumns
          key={weekStart}
          items={weekDays.map((day) => {
            const dayRows = weekRows.filter((r) => r.date === day);
            return {
              day,
              count: dayRows.length,
              content: (
                <div className="flex flex-col gap-2">
                  {dayRows.map((r) => (
                    <MatchLine key={r.id} nameA={r.nameA} nameB={r.nameB} framesA={r.framesA} framesB={r.framesB} sub={r.sub} />
                  ))}
                </div>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
