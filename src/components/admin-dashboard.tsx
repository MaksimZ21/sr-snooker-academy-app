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
  PieChart,
  Pie,
} from "recharts";
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

const TYPE_COLORS: Record<string, string> = {
  private: "#3b82f6",
  group: "#10b981",
  beginners: "#f59e0b",
  advanced: "#8b5cf6",
  technique: "#f97316",
  "match-play": "#f43f5e",
};

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
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">סקירה כללית</p>
        <h1 className="text-2xl font-bold">
          {isLoading || !data ? <Skeleton className="h-8 w-52 inline-block" /> : formatHebrewDate(data.today)}
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users size={20} />} label="תלמידים פעילים" value={data?.students.active} sub={data ? `מתוך ${data.students.total}` : undefined} color="blue" href="/admin/students" isLoading={isLoading} />
        <StatCard icon={<User size={20} />} label="מאמנים פעילים" value={data?.coaches.active} color="violet" href="/admin/coaches" isLoading={isLoading} />
        <StatCard icon={<CalendarDays size={20} />} label="מפגשים היום" value={data?.todaySessions.length} color="emerald" href="/admin/schedule" isLoading={isLoading} />
        <StatCard icon={<Layers size={20} />} label="קבוצות" value={data?.groups} color="amber" href="/admin/groups" isLoading={isLoading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bar chart — sessions per day */}
        <Card className="md:col-span-2">
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
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data?.sessionsByDay ?? []} barSize={28}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v) => [`${v} מפגשים`, ""]}
                    labelFormatter={() => ""}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {(data?.sessionsByDay ?? []).map((entry) => (
                      <Cell
                        key={entry.date}
                        fill={entry.date === data?.today ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.25)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut chart — by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">לפי סוג אימון</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-3">
            {isLoading ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : !data?.sessionsByType.length ? (
              <p className="text-xs text-muted-foreground text-center py-10">אין נתונים השבוע</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={data.sessionsByType}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={3}
                    >
                      {data.sessionsByType.map((entry) => (
                        <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                      formatter={(v, _n, p) => [`${v} מפגשים`, p.payload.label]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5">
                  {data.sessionsByType.map((t) => (
                    <div key={t.type} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[t.type] ?? "#94a3b8" }} />
                      <span className="flex-1 text-muted-foreground">{t.label}</span>
                      <span className="font-semibold tabular-nums">{t.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's sessions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">מפגשים היום</CardTitle>
            <Link href="/admin/schedule" className="text-xs text-primary hover:underline flex items-center gap-0.5">
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
          ) : !data?.todaySessions.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין מפגשים היום</p>
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {data.todaySessions.map((s) => (
                <SessionRow key={s.id} session={s} coachMap={data.coachMap} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              <UpcomingList sessions={data!.upcomingSessions} coachMap={data!.coachMap} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {(isLoading || (data?.alerts.noCoach.length ?? 0) > 0) && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              דרוש טיפול
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-2">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.noCoach.map((s) => <AlertRow key={s.id} session={s} />)
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

const COLOR_CLASSES = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900/40", icon: "text-blue-600 dark:text-blue-400" },
  violet: { bg: "bg-violet-100 dark:bg-violet-900/40", icon: "text-violet-600 dark:text-violet-400" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/40", icon: "text-emerald-600 dark:text-emerald-400" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/40", icon: "text-amber-600 dark:text-amber-400" },
} as const;

function StatCard({ icon, label, value, sub, color, href, isLoading }: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  sub?: string;
  color: keyof typeof COLOR_CLASSES;
  href: string;
  isLoading: boolean;
}) {
  const c = COLOR_CLASSES[color];
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", c.bg)}>
            <span className={c.icon}>{icon}</span>
          </div>
          <div className="min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-10 mb-1" />
                <Skeleton className="h-3.5 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold tabular-nums leading-none">{value ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                {sub && <div className="text-xs text-muted-foreground/60">{sub}</div>}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SessionRow({ session, coachMap }: { session: Session; coachMap: Record<string, string> }) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const coachName = session.coach_email
    ? (coachMap[session.coach_email] ?? session.coach_email.split("@")[0])
    : "ללא מאמן";

  return (
    <Link href={`/admin/sessions/${session.id}`} className="flex items-center gap-3 py-3 hover:bg-muted/40 rounded-lg px-2 -mx-2 transition-colors group">
      <div className="w-16 shrink-0 text-left tabular-nums">
        <div className={cn("text-sm font-semibold", cancelled && "line-through opacity-50")}>{session.start_time}</div>
        <div className="text-xs text-muted-foreground">{session.end_time}</div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs py-0 h-5 shrink-0", className)}>{label}</Badge>
          {cancelled && <Badge variant="destructive" className="text-xs py-0 h-5">בוטל</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{coachName}</span>
          <span>·</span>
          <span className="shrink-0 flex items-center gap-1"><Users size={10} />{session.student_ids.length}</span>
        </div>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function UpcomingList({ sessions, coachMap }: { sessions: Session[]; coachMap: Record<string, string> }) {
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
              <SessionRow key={s.id} session={s} coachMap={coachMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertRow({ session }: { session: Session }) {
  return (
    <Link href={`/admin/sessions/${session.id}`} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">אין מאמן משויך</span>
        <span className="text-sm">{dayLabelHe(session.date)} · {session.start_time}–{session.end_time}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
  );
}
