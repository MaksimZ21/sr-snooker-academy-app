"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { weekRangeFor, todayIsoTel } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

// The week (Sun-Sat) a schedule opens on: the week of the next match day,
// or of the last one once everything is in the past.
export function defaultWeekStart(days: string[]): string {
  const today = todayIsoTel();
  return weekRangeFor(days.find((d) => d >= today) ?? days.at(-1) ?? today).startIso;
}

export function shiftWeekStart(startIso: string, weeks: number): string {
  return format(addDays(parseISO(startIso), 7 * weeks), "yyyy-MM-dd");
}

// Prev / next week arrows with the week's range and match count between them.
export function WeekScheduleNav({
  startIso,
  count,
  onChange,
}: {
  startIso: string;
  count: number;
  onChange: (startIso: string) => void;
}) {
  const { endIso } = weekRangeFor(startIso);
  const currentStart = weekRangeFor(todayIsoTel()).startIso;
  return (
    <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(shiftWeekStart(startIso, -1))} aria-label="שבוע קודם">
        <ChevronRight size={16} />
      </Button>
      <div className="min-w-40 text-center">
        <p className="font-display text-sm font-extrabold tabular-nums">
          {shortDate(startIso)} – {shortDate(endIso)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {startIso === currentStart ? "השבוע · " : ""}
          {count > 0 ? `${count} משחקים` : "אין משחקים"}
        </p>
      </div>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onChange(shiftWeekStart(startIso, 1))} aria-label="שבוע הבא">
        <ChevronLeft size={16} />
      </Button>
      {startIso !== currentStart && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(currentStart)}>
          לשבוע הנוכחי
        </Button>
      )}
    </div>
  );
}
