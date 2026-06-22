"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  Users,
  User,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  Layers,
  MessageSquare,
  Send,
  Loader2,
} from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/app/api/admin/stats/route";
import type { Session } from "@/lib/sheets/schemas";

const AdminChartsRow = dynamic(
  () => import("@/components/admin-charts").then((m) => m.AdminChartsRow),
  { ssr: false },
);

const TYPE_COLORS: Record<string, string> = {
  private: "#3b82f6",
  group: "#10b981",
  beginners: "#f59e0b",
  advanced: "#8b5cf6",
  technique: "#f97316",
  "match-play": "#f43f5e",
};

export function AdminDashboard() {
  const [reminderState, setReminderState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sentCount, setSentCount] = useState(0);

  async function sendReminders() {
    setReminderState("loading");
    try {
      const r = await fetch("/api/cron/daily-reminder", { method: "POST" });
      const json = await r.json();
      setSentCount(json.sent ?? 0);
      setReminderState("done");
    } catch {
      setReminderState("error");
    }
  }

  const { data, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin:stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/stats");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const hasMessages = (data?.newMessages ?? 0) > 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade-in-up">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1">סקירה כללית</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {isLoading || !data ? <Skeleton className="h-8 w-52 inline-block" /> : formatHebrewDate(data.today)}
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot" />
          מחובר
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <StatCard
          icon={<Users size={18} />}
          label="תלמידים פעילים"
          value={data?.students.active}
          sub={data ? `מתוך ${data.students.total}` : undefined}
          href="/admin/students"
          isLoading={isLoading}
          gradient="from-blue-500 to-indigo-600"
          shadow="shadow-blue-500/30"
        />
        <StatCard
          icon={<User size={18} />}
          label="מאמנים פעילים"
          value={data?.coaches.active}
          href="/admin/coaches"
          isLoading={isLoading}
          gradient="from-emerald-500 to-teal-600"
          shadow="shadow-emerald-500/30"
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          label="מפגשים היום"
          value={data?.todaySessions.length}
          href="/admin/schedule"
          isLoading={isLoading}
          gradient="from-primary to-teal-500"
          shadow="shadow-primary/30"
          gradientClass="bg-brand-gradient"
        />
        <StatCard
          icon={<Layers size={18} />}
          label="קבוצות"
          value={data?.groups}
          href="/admin/groups"
          isLoading={isLoading}
          gradient="from-violet-500 to-purple-600"
          shadow="shadow-violet-500/30"
        />
        <StatCard
          icon={<MessageSquare size={18} />}
          label="פניות חדשות"
          value={data?.newMessages}
          href="/admin/messages"
          isLoading={isLoading}
          gradient={hasMessages ? "from-rose-500 to-red-600" : "from-slate-400 to-slate-600"}
          shadow={hasMessages ? "shadow-rose-500/30" : "shadow-slate-400/20"}
          alert={hasMessages}
        />
      </div>

      {/* Charts row */}
      <AdminChartsRow data={data} isLoading={isLoading} />

      {/* Today's sessions */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "180ms" } as React.CSSProperties}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">מפגשים היום</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                disabled={reminderState === "loading"}
                onClick={sendReminders}
              >
                {reminderState === "loading" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {reminderState === "done"
                  ? `נשלח ל-${sentCount} מאמנים`
                  : reminderState === "error"
                    ? "שגיאה בשליחה"
                    : "שלח תזכורות"}
              </Button>
              <Link href="/admin/schedule" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                לוז מלא <ChevronLeft size={12} />
              </Link>
            </div>
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

function StatCard({
  icon, label, value, sub, href, isLoading, gradient, shadow, gradientClass, alert,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  sub?: string;
  href: string;
  isLoading: boolean;
  gradient: string;
  shadow: string;
  gradientClass?: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className="block h-full">
      <div className={cn(
        "group relative h-full rounded-2xl p-4 flex flex-col justify-between gap-3 overflow-hidden",
        "shadow-lg transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl",
        gradientClass ?? `bg-gradient-to-br ${gradient}`,
        shadow,
      )}>
        {/* Decorative circle */}
        <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-1 -bottom-6 w-24 h-24 rounded-full bg-black/10 pointer-events-none" />

        <div className="flex items-start justify-between relative">
          <span className="p-2 rounded-xl bg-white/20 text-white transition-transform duration-200 group-hover:scale-110 group-hover:bg-white/30">
            {icon}
          </span>
          {alert && (
            <span className="w-2 h-2 rounded-full bg-white status-dot" />
          )}
        </div>

        {isLoading ? (
          <div className="relative">
            <Skeleton className="h-9 w-14 mb-1.5 rounded-lg bg-white/20" />
            <Skeleton className="h-3 w-20 rounded bg-white/20" />
          </div>
        ) : (
          <div className="relative">
            <div className="text-3xl font-bold tabular-nums leading-none tracking-tight text-white">
              {value ?? 0}
            </div>
            <div className="text-xs mt-1.5 font-medium text-white/75">{label}</div>
            {sub && <div className="text-[10px] mt-0.5 text-white/50">{sub}</div>}
          </div>
        )}
      </div>
    </Link>
  );
}

function SessionRow({ session, coachMap }: { session: Session; coachMap: Record<string, string> }) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const coachName = session.coach_email
    ? (coachMap[session.coach_email] ?? session.coach_email.split("@")[0])
    : "ללא מאמן";
  const typeColor = TYPE_COLORS[session.training_type] ?? "#94a3b8";

  return (
    <Link href={`/admin/sessions/${session.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40 rounded-xl px-2 -mx-2 transition-colors group">
      <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: cancelled ? "#94a3b8" : typeColor }} />
      <div className="w-14 shrink-0 text-left tabular-nums">
        <div className={cn("text-sm font-semibold", cancelled && "line-through opacity-40")}>{session.start_time}</div>
        <div className="text-[10px] text-muted-foreground">{session.end_time}</div>
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
