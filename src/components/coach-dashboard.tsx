"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Users,
  ChevronLeft,
  CalendarX,
} from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { CoachStats } from "@/app/api/coach/stats/route";
import type { Session } from "@/lib/sheets/schemas";

const CoachBarChart = dynamic(
  () => import("@/components/coach-charts").then((m) => m.CoachBarChart),
  { ssr: false },
);

export function CoachDashboard() {
  const { data, isLoading } = useQuery<CoachStats>({
    queryKey: ["coach:stats"],
    queryFn: async () => {
      const r = await fetch("/api/coach/stats");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const now = new Date();
  const sessions = data?.todaySessions ?? [];
  const nextIdx = sessions.findIndex((s) => {
    const [hh, mm] = s.start_time.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d >= now;
  });
  const nextSession = nextIdx >= 0 ? sessions[nextIdx] : null;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">סקירה אישית</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {isLoading || !data ? (
            <Skeleton className="h-8 w-52 inline-block" />
          ) : (
            formatHebrewDate(data.today)
          )}
        </h1>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <StatCard
          icon={<CalendarDays size={18} />}
          label="מפגשים היום"
          value={data?.todaySessions.length}
          gradient="from-emerald-500 to-teal-600"
          shadow="shadow-emerald-500/30"
          isLoading={isLoading}
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          label="השבוע"
          value={data?.weekSessionCount}
          gradient="from-blue-500 to-indigo-600"
          shadow="shadow-blue-500/30"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users size={18} />}
          label="תלמידים"
          value={data?.weekStudentCount}
          gradient="from-violet-500 to-purple-600"
          shadow="shadow-violet-500/30"
          isLoading={isLoading}
        />
      </div>

      {/* Hero: next session */}
      <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        {isLoading ? (
          <HeroSkeleton />
        ) : nextSession ? (
          <HeroNextCard session={nextSession} />
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <CalendarX size={42} className="opacity-25" />
              <span className="text-sm">אין מפגש קרוב להיום</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bar chart */}
      <CoachBarChart data={data} isLoading={isLoading} />

      {/* Today's sessions */}
      {(isLoading || sessions.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">מפגשים היום</CardTitle>
              <Link
                href="/coach/schedule"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                לוז מלא <ChevronLeft size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/60">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} studentMap={data?.studentMap ?? {}} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function StatCard({
  icon, label, value, gradient, shadow, isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  gradient: string;
  shadow: string;
  isLoading: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl p-3.5 flex flex-col gap-2.5 overflow-hidden",
      "shadow-lg",
      `bg-gradient-to-br ${gradient}`,
      shadow,
    )}>
      <div className="absolute -left-3 -top-3 w-14 h-14 rounded-full bg-white/10 pointer-events-none" />
      <span className="p-1.5 rounded-lg bg-white/20 text-white w-fit">
        {icon}
      </span>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-10 rounded-lg bg-white/20" />
          <Skeleton className="h-3 w-14 rounded bg-white/20" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold tabular-nums leading-none text-white">{value ?? 0}</div>
          <div className="text-xs font-medium text-white/75 leading-tight">{label}</div>
        </>
      )}
    </div>
  );
}

function HeroNextCard({ session }: { session: Session }) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";

  return (
    <Link href={`/coach/sessions/${session.id}`}>
      <Card className="overflow-hidden border-2 border-primary/25 hover:border-primary/50 hover:shadow-xl transition-all duration-300 group">
        <div className="bg-brand-gradient px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-xs uppercase tracking-widest text-white/90 font-semibold">
              המפגש הבא
            </span>
          </div>
          <Badge className={cn("border text-xs font-medium", className)} variant="outline">
            {label}
          </Badge>
        </div>
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <div className={cn(
                "text-5xl md:text-6xl font-bold tabular-nums tracking-tight leading-none text-foreground group-hover:text-primary transition-colors duration-300",
                cancelled && "opacity-40 line-through",
              )}>
                {session.start_time}
              </div>
              <div className="text-muted-foreground mt-2 text-sm">עד {session.end_time}</div>
            </div>
            {cancelled && <Badge variant="destructive" className="self-start">בוטל</Badge>}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={15} />
              <span>{session.student_ids.length} מתאמנים</span>
            </div>
            <div className="flex items-center gap-0.5 text-sm text-primary font-semibold group-hover:gap-1.5 transition-all duration-200">
              <span>פתח פרטים</span>
              <ChevronLeft size={15} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HeroSkeleton() {
  return (
    <Card className="overflow-hidden border-2 border-primary/10">
      <div className="bg-brand-gradient px-5 py-3">
        <Skeleton className="h-4 w-32 bg-white/20" />
      </div>
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
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
          {cancelled && <Badge variant="destructive" className="text-xs py-0 h-5">בוטל</Badge>}
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
