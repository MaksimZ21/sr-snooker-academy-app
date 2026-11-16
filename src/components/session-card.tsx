"use client";
import { useQuery } from "@tanstack/react-query";
import { Users, Banknote, CheckCircle2, CircleDashed } from "lucide-react";
import type { Group, Session } from "@/lib/sheets/schemas";
import { dayLetterHe, todayIsoTel } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { TYPE_COLORS } from "@/components/broadcast";
import { ScheduleSlot, shortSlotTitle } from "@/components/schedule-slot";

export function SessionCard({
  session,
  basePath,
  showDate = false,
}: {
  // On lists that aren't laid out by day (e.g. "my sessions").
  showDate?: boolean;
  // attendance_marked: only on the schedule's lists (week / mine).
  session: Session & { attendance_marked?: boolean };
  basePath: "coach" | "admin";
}) {
  const { label } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: Group[] };
    },
    staleTime: 5 * 60_000,
  });
  const groupName = session.group_id
    ? groupsQ.data?.groups.find((g) => g.id === session.group_id)?.name
    : undefined;
  // A session with no name or group (a private lesson): its type says what it is.
  const title = shortSlotTitle(session.name || groupName || `אימון ${label}`);
  // "Not taken" only matters once the session's day has come.
  const attendance =
    cancelled || session.attendance_marked === undefined
      ? null
      : session.attendance_marked
        ? "marked"
        : session.date <= todayIsoTel()
          ? "missing"
          : null;

  return (
    <ScheduleSlot
      href={`/${basePath}/sessions/${session.id}`}
      color={TYPE_COLORS[session.training_type] ?? "#94a3b8"}
      start={session.start_time}
      end={session.end_time}
      kind={cancelled ? <span className="text-destructive">לא התקיים</span> : label}
      title={title}
      cancelled={cancelled}
      meta={
        <>
          {showDate && (
            <span className="font-display font-bold text-foreground">
              {dayLetterHe(session.date)} {session.date.slice(8, 10)}.{session.date.slice(5, 7)}
            </span>
          )}
          <span className="flex items-center gap-0.5 tabular-nums">
            <Users size={11} />
            {session.student_ids.length}
          </span>
          {session.price_nis != null && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Banknote size={11} />
              {session.price_nis}₪
            </span>
          )}
          {session.source && <span className="truncate">{session.source}</span>}
        </>
      }
      status={
        attendance === "marked" ? (
          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 size={12} />
            נוכחות
          </span>
        ) : attendance === "missing" ? (
          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 shrink-0">
            <CircleDashed size={12} />
            לא סומנה
          </span>
        ) : null
      }
    />
  );
}
