"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SessionCard } from "./session-card";
import { TournamentScheduleCard } from "./tournament-schedule-card";
import { IntroEventScheduleCard } from "./intro-event-schedule-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/lib/sheets/schemas";
import type { Tournament } from "@/lib/sheets/tournaments";
import type { IntroEventView } from "@/lib/sheets/intro-events";
import { cn } from "@/lib/utils";

const SHORT_DAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

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
  const [selectedDay, setSelectedDay] = useState(today);

  // Jumping to a different week (prev/next/"היום") picks a sensible day to
  // focus on for the mobile single-day view: today itself when the new
  // week contains it, otherwise that week's first day.
  function goToWeek(newAnchor: string) {
    setAnchor(newAnchor);
    const { startIso: newStart, endIso: newEnd } = weekRangeFor(newAnchor);
    setSelectedDay(today >= newStart && today <= newEnd ? today : newStart);
  }

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

  // Only CRM-created tournaments ever come back here — see
  // fetchTournamentsInRange. Not filtered by coach: a tournament has no
  // per-coach roster concept the way a session does.
  const { data: tournamentsData } = useQuery({
    queryKey: ["tournaments:week", startIso, endIso],
    queryFn: async () => {
      const url = new URL("/api/tournaments/week", window.location.origin);
      url.searchParams.set("start", startIso);
      url.searchParams.set("end", endIso);
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { tournaments: Tournament[] };
    },
    refetchInterval: basePath === "admin" ? 30_000 : 60_000,
  });

  // Every intro event has an event_date (CRM-only creation) — same
  // no-coach-filtering shape as the tournaments query above.
  const { data: introEventsData } = useQuery({
    queryKey: ["intro-events:week", startIso, endIso],
    queryFn: async () => {
      const url = new URL("/api/intro-events/week", window.location.origin);
      url.searchParams.set("start", startIso);
      url.searchParams.set("end", endIso);
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { events: IntroEventView[] };
    },
    refetchInterval: basePath === "admin" ? 30_000 : 60_000,
  });

  const days = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(startIso), i), "yyyy-MM-dd"),
  );

  const startDisplay = `${startIso.slice(8, 10)}.${startIso.slice(5, 7)}`;
  const endDisplay = `${endIso.slice(8, 10)}.${endIso.slice(5, 7)}`;

  function renderDay(iso: string) {
    const ses = (data?.sessions ?? []).filter((s) => s.date === iso);
    const tournamentsToday = (tournamentsData?.tournaments ?? []).filter((t) => t.event_date === iso);
    const introEventsToday = (introEventsData?.events ?? []).filter((e) => e.event_date === iso);
    // Sessions and intro events interleaved by start time ("HH:MM" sorts
    // correctly as a string). Tournaments have no time, so they stay on top.
    const timed = [
      ...ses.map((s) => ({ start: s.start_time, card: <SessionCard key={s.id} session={s} basePath={basePath} /> })),
      ...introEventsToday.map((e) => ({ start: e.start_time, card: <IntroEventScheduleCard key={e.id} event={e} basePath={basePath} /> })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    const isToday = iso === today;
    const count = timed.length + tournamentsToday.length;
    return (
      <div key={iso} className="flex flex-col gap-2 min-w-0">
        <div
          className={cn(
            "flex items-center justify-between gap-1 rounded-xl px-3 py-2",
            isToday ? "bg-primary text-white" : "bg-card border",
          )}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-extrabold text-sm">{dayLabelHe(iso)}</span>
            <span className={cn("bc-num text-sm", isToday ? "text-white/80" : "text-muted-foreground")}>
              {iso.slice(8, 10)}.{iso.slice(5, 7)}
            </span>
          </div>
          {isToday ? (
            <span className="font-display text-[11px] font-bold bg-white/20 rounded-md px-1.5 py-0.5">היום</span>
          ) : count > 0 ? (
            <span className="font-display text-[11px] font-bold text-muted-foreground tabular-nums">{count}</span>
          ) : null}
        </div>
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        ) : (
          <>
            {timed.length === 0 && tournamentsToday.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6 rounded-xl border border-dashed">אין אימונים</div>
            )}
            {tournamentsToday.map((t) => (
              <TournamentScheduleCard key={t.id} tournament={t} basePath={basePath} />
            ))}
            {timed.map((item) => item.card)}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Week bar: the dark control-room strip of the broadcast look. */}
      <div className="flex items-center gap-2 bg-sidebar text-white rounded-2xl p-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToWeek(format(addDays(parseISO(anchor), -7), "yyyy-MM-dd"))}
          className="h-9 px-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
        >
          <ChevronRight size={16} />
          <span className="hidden sm:inline">שבוע קודם</span>
        </Button>

        <div className="flex-1 flex items-center justify-center gap-3">
          <span className="bc-num text-lg md:text-xl">
            {startDisplay} – {endDisplay}
          </span>
          {!(today >= startIso && today <= endIso) && (
            <Button
              size="sm"
              onClick={() => goToWeek(todayIsoTel())}
              className="h-7 px-3 rounded-lg bg-primary text-white hover:bg-primary/85"
            >
              חזרה להיום
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToWeek(format(addDays(parseISO(anchor), 7), "yyyy-MM-dd"))}
          className="h-9 px-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
        >
          <span className="hidden sm:inline">שבוע הבא</span>
          <ChevronLeft size={16} />
        </Button>
      </div>

      {/* Mobile: one day at a time, switched via the strip below, instead
          of all 7 days stacked vertically and needing a long scroll to
          find today. Desktop keeps the full 7-column week grid. */}
      <div className="flex items-center gap-1 md:hidden">
        {days.map((iso) => {
          const isSelected = iso === selectedDay;
          const isToday = iso === today;
          const weekday = parseISO(iso).getDay();
          const busy =
            (data?.sessions ?? []).some((x) => x.date === iso) ||
            (tournamentsData?.tournaments ?? []).some((t) => t.event_date === iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(iso)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 transition-colors border",
                isSelected
                  ? "bg-primary border-primary text-white"
                  : isToday
                    ? "bg-card border-primary/50 text-primary"
                    : "bg-card text-muted-foreground",
              )}
            >
              <span className="font-display text-xs font-bold">{SHORT_DAY_LABELS[weekday]}</span>
              <span className="bc-num text-base leading-none">{iso.slice(8, 10)}</span>
              <i className={cn("w-1 h-1 rounded-full", busy ? (isSelected ? "bg-white" : "bg-primary") : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <div className="md:hidden">{renderDay(selectedDay)}</div>

      <div className="hidden md:grid md:grid-cols-7 gap-2.5">
        {days.map((iso) => renderDay(iso))}
      </div>
    </div>
  );
}
