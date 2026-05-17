"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  User,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  Layers,
} from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/app/api/admin/stats/route";
import type { Session } from "@/lib/sheets/schemas";

export function AdminDashboard() {
  const { data, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin:stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/stats");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Header */}
      <h1 className="text-xl font-bold">
        {isLoading || !data ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          formatHebrewDate(data.today)
        )}
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="תלמידים פעילים"
          value={data?.students.active}
          sub={data ? `מתוך ${data.students.total}` : undefined}
          icon={<Users size={18} />}
          href="/admin/students"
          color="blue"
          isLoading={isLoading}
        />
        <StatCard
          label="מאמנים"
          value={data?.coaches.active}
          sub={data ? `פעילים` : undefined}
          icon={<User size={18} />}
          href="/admin/coaches"
          color="indigo"
          isLoading={isLoading}
        />
        <StatCard
          label="מפגשים היום"
          value={data?.todaySessions.length}
          icon={<CalendarDays size={18} />}
          href="/admin/schedule"
          color="emerald"
          isLoading={isLoading}
        />
        <StatCard
          label="קבוצות"
          value={data?.groups}
          icon={<Layers size={18} />}
          href="/admin/groups"
          color="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Today's sessions */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>היום</SectionLabel>
          <Link
            href="/admin/schedule"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            לוז מלא
            <ChevronLeft size={13} />
          </Link>
        </div>
        {isLoading ? (
          <SkeletonList count={2} height="h-[66px]" />
        ) : !data?.todaySessions.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            אין מפגשים היום
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.todaySessions.map((s) => (
              <SessionRow key={s.id} session={s} coachMap={data.coachMap} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming (next 7 days) */}
      {(isLoading || (data?.upcomingSessions.length ?? 0) > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>בקרוב</SectionLabel>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.weekSessionCount} מפגשים השבוע
              </span>
            )}
          </div>
          {isLoading ? (
            <SkeletonList count={3} height="h-12" />
          ) : (
            <UpcomingList
              sessions={data!.upcomingSessions}
              coachMap={data!.coachMap}
            />
          )}
        </section>
      )}

      {/* Alerts */}
      {(isLoading || (data?.alerts.noCoach.length ?? 0) > 0) && (
        <section className="flex flex-col gap-3">
          <SectionLabel icon={<AlertCircle size={13} className="text-amber-500" />}>
            דרוש טיפול
          </SectionLabel>
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : (
            <div className="flex flex-col gap-2">
              {data!.alerts.noCoach.map((s) => (
                <AlertRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

const COLOR_MAP = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
} as const;

function StatCard({
  label,
  value,
  sub,
  icon,
  href,
  color,
  isLoading,
}: {
  label: string;
  value?: number;
  sub?: string;
  icon: React.ReactNode;
  href: string;
  color: keyof typeof COLOR_MAP;
  isLoading: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", COLOR_MAP[color])}>
            {icon}
          </div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3.5 w-20" />
            </>
          ) : (
            <>
              <span className="text-2xl font-bold tabular-nums leading-none">
                {value ?? 0}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{label}</span>
                {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function SessionRow({
  session,
  coachMap,
}: {
  session: Session;
  coachMap: Record<string, string>;
}) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const coachName = session.coach_email
    ? (coachMap[session.coach_email] ?? session.coach_email.split("@")[0])
    : "ללא מאמן";

  return (
    <Link href={`/admin/sessions/${session.id}`}>
      <Card
        className={cn(
          "hover:shadow-sm transition-shadow",
          cancelled && "opacity-60",
        )}
      >
        <CardContent className="px-4 py-3 flex items-center gap-3">
          <div className="flex flex-col items-end shrink-0 w-20 tabular-nums">
            <span className={cn("text-sm font-semibold", cancelled && "line-through")}>
              {session.start_time}
            </span>
            <span className="text-xs text-muted-foreground">{session.end_time}</span>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs py-0 h-5", className)}>
                {label}
              </Badge>
              {cancelled && (
                <Badge variant="destructive" className="text-xs py-0 h-5">
                  בוטל
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{coachName}</span>
              <span>·</span>
              <span className="flex items-center gap-1 shrink-0">
                <Users size={11} />
                {session.student_ids.length}
              </span>
            </div>
          </div>

          <ChevronLeft size={15} className="text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

function UpcomingList({
  sessions,
  coachMap,
}: {
  sessions: Session[];
  coachMap: Record<string, string>;
}) {
  const byDate = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(byDate).map(([date, daySessions]) => (
        <div key={date} className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {dayLabelHe(date)}{" "}
            <span className="text-muted-foreground/60">{date.slice(5).replace("-", "/")}</span>
          </span>
          {daySessions.map((s) => (
            <SessionRow key={s.id} session={s} coachMap={coachMap} />
          ))}
        </div>
      ))}
    </div>
  );
}

function AlertRow({ session }: { session: Session }) {
  return (
    <Link href={`/admin/sessions/${session.id}`}>
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 hover:shadow-sm transition-shadow">
        <CardContent className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              אין מאמן משויך
            </span>
            <span className="text-sm">
              {dayLabelHe(session.date)} · {session.start_time}–{session.end_time}
            </span>
          </div>
          <ChevronLeft size={15} className="text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
      {icon}
      {children}
    </h2>
  );
}

function SkeletonList({ count, height }: { count: number; height: string }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", height)} />
      ))}
    </div>
  );
}
