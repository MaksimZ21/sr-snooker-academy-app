"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
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
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">סקירה אישית</p>
        <h1 className="text-2xl font-bold">
          {isLoading || !data ? (
            <Skeleton className="h-8 w-52 inline-block" />
          ) : (
            formatHebrewDate(data.today)
          )}
        </h1>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        <StatChip
          icon={<CalendarDays size={16} />}
          label="מפגשים היום"
          value={data?.todaySessions.length}
          color="emerald"
          isLoading={isLoading}
        />
        <StatChip
          icon={<CalendarDays size={16} />}
          label="מפגשים השבוע"
          value={data?.weekSessionCount}
          color="blue"
          isLoading={isLoading}
        />
        <StatChip
          icon={<Users size={16} />}
          label="תלמידים השבוע"
          value={data?.weekStudentCount}
          color="violet"
          isLoading={isLoading}
        />
      </div>

      {/* Hero: next session */}
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

      {/* Bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">מפגשים השבוע</CardTitle>
            {data && (
              <span className="text-xs text-muted-foreground">
                סה״כ {data.weekSessionCount}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={data?.sessionsByDay ?? []} barSize={24}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                  }}
                  formatter={(v) => [`${v} מפגשים`, ""]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data?.sessionsByDay ?? []).map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={
                        entry.date === data?.today
                          ? "hsl(var(--primary))"
                          : "hsl(var(--primary) / 0.25)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

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
                  <SessionRow
                    key={s.id}
                    session={s}
                    studentMap={data?.studentMap ?? {}}
                  />
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
              <UpcomingList
                sessions={data!.upcomingSessions}
                studentMap={data!.studentMap}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

const CHIP_COLORS = {
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    icon: "text-blue-600 dark:text-blue-400",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    icon: "text-violet-600 dark:text-violet-400",
  },
} as const;

function StatChip({
  icon,
  label,
  value,
  color,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  color: keyof typeof CHIP_COLORS;
  isLoading: boolean;
}) {
  const c = CHIP_COLORS[color];
  return (
    <Card>
      <CardContent className="p-3 flex flex-col gap-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", c.bg)}>
          <span className={c.icon}>{icon}</span>
        </div>
        {isLoading ? (
          <>
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-3 w-16" />
          </>
        ) : (
          <>
            <div className="text-xl font-bold tabular-nums leading-none">{value ?? 0}</div>
            <div className="text-xs text-muted-foreground leading-tight">{label}</div>
          </>
        )}
      </CardContent>
    </Card>
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
              <div
                className={cn(
                  "text-5xl md:text-6xl font-bold tabular-nums tracking-tight leading-none text-foreground group-hover:text-primary transition-colors duration-300",
                  cancelled && "opacity-40 line-through",
                )}
              >
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

function SessionRow({
  session,
  studentMap,
}: {
  session: Session;
  studentMap: Record<string, string>;
}) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const studentNames = session.student_ids
    .map((id) => studentMap[id] ?? id)
    .join(", ");

  return (
    <Link
      href={`/coach/sessions/${session.id}`}
      className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors group"
    >
      <div className="w-16 shrink-0 text-left tabular-nums">
        <div className={cn("text-sm font-semibold", cancelled && "line-through opacity-50")}>
          {session.start_time}
        </div>
        <div className="text-xs text-muted-foreground">{session.end_time}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs py-0 h-5 shrink-0", className)}>
            {label}
          </Badge>
          {cancelled && (
            <Badge variant="destructive" className="text-xs py-0 h-5">
              בוטל
            </Badge>
          )}
        </div>
        {studentNames && (
          <div className="text-xs text-muted-foreground truncate">{studentNames}</div>
        )}
      </div>
      <ChevronLeft
        size={14}
        className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}

function UpcomingList({
  sessions,
  studentMap,
}: {
  sessions: Session[];
  studentMap: Record<string, string>;
}) {
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
