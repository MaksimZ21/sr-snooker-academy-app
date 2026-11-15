"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import dynamic from "next/dynamic";
import { Users, AlertCircle, ChevronLeft, Send, Loader2, UserX, CircleDollarSign } from "lucide-react";
import { formatHebrewDate, dayLabelHe } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { AdminStats, AbsentStudent, PaymentDueStudent } from "@/app/api/admin/stats/route";
import type { Session } from "@/lib/sheets/schemas";
import { BallTile, BroadcastRow, LiveTicker, TYPE_COLORS, TypeSplit, WeekBars, nowHHMM } from "@/components/broadcast";
const CollegesCard = dynamic(
  () => import("@/components/colleges-card").then((m) => m.CollegesCard),
  { ssr: false },
);

export function AdminDashboard({ displayName = "" }: { displayName?: string }) {
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
    refetchInterval: 120_000,
  });

  const hasMessages = (data?.newMessages ?? 0) > 0;

  const now = nowHHMM();
  const todaySessions = data?.todaySessions ?? [];
  const live = todaySessions.filter((x) => x.status !== "cancelled");
  const next = live.find((x) => x.end_time > now);
  const alerts = data
    ? [
        { n: data.alerts.absentStudents.length, label: "לא הגיעו 3 שבועות", color: "#e2408a" },
        { n: data.alerts.paymentDue.length, label: "צריכים לשלם", color: "#d99a00" },
        { n: data.alerts.noCoach.length, label: "מפגשים בלי מאמן", color: "#d61f2c" },
      ]
    : [];

  return (
    <div className="flex flex-col">
      <LiveTicker
        isLoading={isLoading}
        items={live.map((x) => ({
          id: x.id,
          time: x.start_time,
          text: `${trainingTypeBadge(x.training_type).label} · ${x.coach_email ? (data?.coachMap[x.coach_email] ?? x.coach_email.split("@")[0]) : "ללא מאמן"} · ${x.student_ids.length} מתאמנים`,
        }))}
      />

      <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 bc-slide">
        <div>
          <p className="bc-kicker text-[13px] text-primary">לוח בקרה</p>
          <h1 className="bc-num text-[32px] md:text-[44px] leading-[1.05] mt-1.5">
            {displayName ? `שלום, ${displayName}` : "שלום"}
          </h1>
        </div>
        <div className="hidden md:block font-display font-bold text-[15px] text-muted-foreground bg-card border rounded-xl px-4 py-2.5">
          {isLoading || !data ? <Skeleton className="h-4 w-40" /> : formatHebrewDate(data.today)}
        </div>
      </div>

      <PushNotificationBanner />

      {/* Tiles: today's sessions leads, the rest are balls */}
      <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3.5">
        <Link
          href="/admin/schedule"
          className="col-span-2 md:col-span-1 relative overflow-hidden rounded-[18px] p-[18px] text-white bg-linear-to-br from-[#0e8f45] to-[#075a2b] bc-slide transition-transform duration-200 hover:-translate-y-1"
        >
          <div className="absolute inset-0 bc-stripes" />
          <div className="relative">
            <p className="font-display font-bold text-[13px] text-white/75">מפגשים היום</p>
            {isLoading ? (
              <Skeleton className="h-20 w-24 mt-2 bg-white/20" />
            ) : (
              <p className="bc-num text-[84px] leading-none mt-2.5">{live.length}</p>
            )}
            <p className="text-[13px] text-white/75 mt-1 min-h-5">
              {next ? `הבא: ${next.start_time} · ${trainingTypeBadge(next.training_type).label}` : !isLoading ? "אין עוד מפגשים היום" : ""}
            </p>
          </div>
        </Link>
        <BallTile label="תלמידים פעילים" value={data?.students.active} sub={data ? `מתוך ${data.students.total}` : undefined} href="/admin/students" ball="yellow" isLoading={isLoading} delay={0.12} />
        <BallTile label="מאמנים פעילים" value={data?.coaches.active} href="/admin/coaches" ball="green" isLoading={isLoading} delay={0.19} />
        <BallTile label="קבוצות" value={data?.groups} href="/admin/groups" ball="blue" isLoading={isLoading} delay={0.26} />
        <BallTile label="פניות חדשות" value={data?.newMessages} href="/admin/messages" ball={hasMessages ? "pink" : "black"} isLoading={isLoading} delay={0.33} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5">
        {/* Today's sessions */}
        <section className="bg-card border rounded-[18px] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b">
            <h2 className="font-display font-extrabold text-base">מפגשים היום</h2>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                disabled={reminderState === "loading"}
                onClick={sendReminders}
              >
                {reminderState === "loading" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {reminderState === "done"
                  ? `נשלח ל-${sentCount} מאמנים`
                  : reminderState === "error"
                    ? "שגיאה בשליחה"
                    : "שלח תזכורות"}
              </Button>
              <Link href="/admin/schedule" className="text-[13px] font-bold text-primary hover:underline flex items-center gap-0.5">
                לו״ז מלא <ChevronLeft size={13} />
              </Link>
            </div>
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : !todaySessions.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">אין מפגשים היום</p>
          ) : (
            <div className="flex flex-col">
              {todaySessions.map((x) => (
                <BroadcastRow
                  key={x.id}
                  session={x}
                  href={`/admin/sessions/${x.id}`}
                  who={`${trainingTypeBadge(x.training_type).label} · ${x.student_ids.length} מתאמנים`}
                  sub={x.coach_email ? (data!.coachMap[x.coach_email] ?? x.coach_email.split("@")[0]) : "ללא מאמן"}
                  now={now}
                />
              ))}
            </div>
          )}
        </section>

        {/* The week in numbers */}
        <section className="bg-card border rounded-[18px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-[18px] py-3.5 border-b">
            <h2 className="font-display font-extrabold text-base">השבוע במספרים</h2>
            {data && <span className="font-display font-bold text-[13px] text-muted-foreground">{data.weekSessionCount} מפגשים</span>}
          </div>
          {isLoading || !data ? (
            <Skeleton className="h-44 m-4 rounded-lg" />
          ) : (
            <>
              <WeekBars days={data.sessionsByDay} today={data.today} />
              {data.sessionsByType.length > 0 && <TypeSplit slices={data.sessionsByType} />}
              <div className="grid grid-cols-3 border-t mt-auto">
                {alerts.map((al, i) => (
                  <div key={al.label} className={cn("px-[18px] py-3.5", i > 0 && "border-s")}>
                    <span className="bc-num text-[30px] leading-none block" style={{ color: al.color }}>{al.n}</span>
                    <p className="text-[13px] text-muted-foreground mt-1">{al.label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
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
              <UpcomingList sessions={data!.upcomingSessions} coachMap={data!.coachMap} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts: no coach */}
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

      {/* Colleges management */}
      <CollegesCard />

      {/* Alerts: absent students (3 weeks) */}
      {(isLoading || (data?.alerts.absentStudents.length ?? 0) > 0) && (
        <Card className="border-rose-200 dark:border-rose-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserX size={14} className="text-rose-500" />
              לא הגיעו 3 שבועות
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-1.5">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.absentStudents.map((s) => <AbsentStudentRow key={s.id} student={s} />)
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts: payment due (30+ days since last payment) */}
      {(isLoading || (data?.alerts.paymentDue.length ?? 0) > 0) && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CircleDollarSign size={14} className="text-orange-500" />
              צריך לשלם
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-col gap-1.5">
            {isLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : (
              data!.alerts.paymentDue.map((s) => <PaymentDueRow key={s.id} student={s} />)
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

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
          {cancelled && <Badge variant="destructive" className="text-xs py-0 h-5">לא התקיים</Badge>}
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

function AbsentStudentRow({ student }: { student: AbsentStudent }) {
  return (
    <Link
      href={`/admin/students?highlight=${student.id}`}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <UserX size={13} className="text-rose-400 shrink-0" />
        <span className="text-sm">{student.name}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
  );
}

function PaymentDueRow({ student }: { student: PaymentDueStudent }) {
  return (
    <Link
      href={`/admin/students?highlight=${student.id}`}
      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/60 dark:hover:bg-orange-950/40 transition-colors"
    >
      <div className="flex items-center gap-2">
        <CircleDollarSign size={13} className="text-orange-400 shrink-0" />
        <span className="text-sm">{student.name}</span>
      </div>
      <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
    </Link>
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
