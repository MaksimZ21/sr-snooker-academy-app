"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, CalendarX } from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { CoachStats } from "@/app/api/coach/stats/route";
import type { Session } from "@/lib/sheets/schemas";
import { BallTile, BroadcastRow, LiveTicker, WeekBars, nowHHMM } from "@/components/broadcast";

export function CoachDashboard({ displayName = "" }: { displayName?: string }) {
  const { data, isLoading } = useQuery<CoachStats>({
    queryKey: ["coach:stats"],
    queryFn: async () => {
      const r = await fetch("/api/coach/stats");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    refetchInterval: 120_000,
  });

  const now = nowHHMM();
  const sessions = data?.todaySessions ?? [];
  const live = sessions.filter((x) => x.status !== "cancelled");
  const nextSession = live.find((x) => x.end_time > now) ?? null;
  const namesOf = (x: Session) => x.student_ids.map((id) => data?.studentMap[id] ?? id).join(", ");

  return (
    <div className="flex flex-col">
      <LiveTicker
        isLoading={isLoading}
        label="היום שלי"
        items={live.map((x) => ({
          id: x.id,
          time: x.start_time,
          text: `${trainingTypeBadge(x.training_type).label} · ${namesOf(x) || "אין מתאמנים"}`,
        }))}
      />
      <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 bc-slide">
        <div>
          <p className="bc-kicker text-[13px] text-primary">המאמן</p>
          <h1 className="bc-num text-[32px] md:text-[44px] leading-[1.05] mt-1.5">
            {displayName ? `שלום, ${displayName}` : "שלום"}
          </h1>
        </div>
        <div className="hidden md:block font-display font-bold text-[15px] text-muted-foreground bg-card border rounded-xl px-4 py-2.5">
          {isLoading || !data ? <Skeleton className="h-4 w-40" /> : formatHebrewDate(data.today)}
        </div>
      </div>

      {/* Tiles: the next session leads */}
      <div className="grid grid-cols-3 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3.5">
        <NextTile session={nextSession} isLoading={isLoading} names={nextSession ? namesOf(nextSession) : ""} />
        <BallTile label="מפגשים היום" value={live.length} ball="red" isLoading={isLoading} delay={0.12} />
        <BallTile label="השבוע" value={data?.weekSessionCount} ball="blue" isLoading={isLoading} delay={0.19} />
        <BallTile label="תלמידים השבוע" value={data?.weekStudentCount} ball="yellow" isLoading={isLoading} delay={0.26} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
        <section className="bg-card border rounded-[18px] overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3.5 border-b">
            <h2 className="font-display font-extrabold text-base">מפגשים היום</h2>
            <Link href="/coach/schedule" className="text-[13px] font-bold text-primary hover:underline flex items-center gap-0.5">
              לו״ז מלא <ChevronLeft size={13} />
            </Link>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : !sessions.length ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <CalendarX size={36} className="opacity-30" />
              <span className="text-sm">אין לך מפגשים היום</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {sessions.map((x) => (
                <BroadcastRow
                  key={x.id}
                  session={x}
                  href={`/coach/sessions/${x.id}`}
                  who={namesOf(x) || "אין מתאמנים"}
                  sub={`${trainingTypeBadge(x.training_type).label} · ${x.student_ids.length} מתאמנים`}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border rounded-[18px] overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3.5 border-b">
            <h2 className="font-display font-extrabold text-base">השבוע במספרים</h2>
            {data && <span className="font-display font-bold text-[13px] text-muted-foreground">{data.weekSessionCount} מפגשים</span>}
          </div>
          {isLoading || !data ? <Skeleton className="h-44 m-4 rounded-lg" /> : <WeekBars days={data.sessionsByDay} today={data.today} />}
        </section>
      </div>

      {/* Upcoming */}
      {(isLoading || (data?.upcomingSessions.length ?? 0) > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">בקרוב</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <UpcomingList sessions={data!.upcomingSessions} studentMap={data!.studentMap} />
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

// The big green tile: when the next session starts, with whom.
function NextTile({ session, isLoading, names }: { session: Session | null; isLoading: boolean; names: string }) {
  const body = (
    <>
      <div className="absolute inset-0 bc-stripes" />
      <div className="relative">
        <p className="font-display font-bold text-[13px] text-white/75">המפגש הבא</p>
        {isLoading ? (
          <Skeleton className="h-20 w-36 mt-2 bg-white/20" />
        ) : session ? (
          <>
            <p className="bc-num text-[64px] md:text-[84px] leading-none mt-2.5">{session.start_time}</p>
            <p className="text-[13px] text-white/80 mt-1 truncate">
              {trainingTypeBadge(session.training_type).label} · עד {session.end_time}
              {names ? ` · ${names}` : ""}
            </p>
          </>
        ) : (
          <p className="bc-num text-[34px] leading-tight mt-3">אין עוד מפגשים היום</p>
        )}
      </div>
    </>
  );
  const cls =
    "col-span-3 md:col-span-1 relative overflow-hidden rounded-[18px] p-[18px] text-white bg-linear-to-br from-[#0e8f45] to-[#075a2b] bc-slide";
  return session ? (
    <Link href={`/coach/sessions/${session.id}`} className={cn(cls, "transition-transform duration-200 hover:-translate-y-1")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function SessionRow({ session, studentMap }: { session: Session; studentMap: Record<string, string> }) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const studentNames = session.student_ids.map((id) => studentMap[id] ?? id).join(", ");

  return (
    <Link
      href={`/coach/sessions/${session.id}`}
      className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors group"
    >
      <div className="w-16 shrink-0 text-left tabular-nums">
        <div className={cn("text-sm font-semibold", cancelled && "line-through opacity-50")}>{session.start_time}</div>
        <div className="text-xs text-muted-foreground">{session.end_time}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs py-0 h-5 shrink-0", className)}>{label}</Badge>
          {cancelled && <Badge variant="destructive" className="text-xs py-0 h-5">לא התקיים</Badge>}
        </div>
        {studentNames && <div className="text-xs text-muted-foreground truncate">{studentNames}</div>}
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function UpcomingList({ sessions, studentMap }: { sessions: Session[]; studentMap: Record<string, string> }) {
  const byDate = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(byDate).map(([date, daySessions]) => (
        <div key={date} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {dayLabelHe(date)} · {date.slice(5).replace("-", "/")}
          </span>
          <div className="flex flex-col divide-y divide-border/60">
            {daySessions.map((s) => (
              <SessionRow key={s.id} session={s} studentMap={studentMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
