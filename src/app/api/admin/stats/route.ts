import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchSessionsAll } from "@/lib/sheets/sessions";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { db } from "@/lib/db/client";
import { todayIsoTel, weekRangeFor, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import { countNewContactRequests } from "@/lib/sheets/contact";
import type { Session } from "@/lib/sheets/schemas";

export type DayBar = { date: string; day: string; count: number };
export type TypeSlice = { type: string; label: string; count: number };

export type AdminStats = {
  today: string;
  students: { total: number; active: number };
  coaches: { total: number; active: number };
  groups: number;
  weekSessionCount: number;
  todaySessions: Session[];
  upcomingSessions: Session[];
  coachMap: Record<string, string>;
  alerts: { noCoach: Session[] };
  sessionsByDay: DayBar[];
  sessionsByType: TypeSlice[];
  newMessages: number;
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const today = todayIsoTel();
    const { startIso, endIso } = weekRangeFor(today);
    const nextWeekEnd = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

    const [students, sessions, groups, coachRows, newMessages] = await Promise.all([
      fetchStudents(),
      fetchSessionsAll(),
      fetchGroupsAll(),
      db.from("coaches").select("email, name, active"),
      countNewContactRequests(),
    ]);

    const coachMap: Record<string, string> = {};
    for (const c of (coachRows.data ?? []) as { email: string; name: string }[]) {
      coachMap[c.email] = c.name;
    }

    const todaySessions = sessions
      .filter((s) => s.date === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const upcomingSessions = sessions
      .filter((s) => s.date > today && s.date <= nextWeekEnd && s.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .slice(0, 20);

    const noCoachSessions = sessions
      .filter((s) => !s.coach_email && s.date >= today && s.status === "scheduled")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);

    // Chart: sessions per day this week
    const weekSessions = sessions.filter(
      (s) => s.date >= startIso && s.date <= endIso && s.status !== "cancelled",
    );
    const sessionsByDay: DayBar[] = Array.from({ length: 7 }, (_, i) => {
      const date = format(addDays(parseISO(startIso), i), "yyyy-MM-dd");
      return {
        date,
        day: dayLabelHe(date).slice(0, 3),
        count: weekSessions.filter((s) => s.date === date).length,
      };
    });

    // Chart: sessions by training type this week
    const typeCounts: Record<string, number> = {};
    for (const s of weekSessions) {
      typeCounts[s.training_type] = (typeCounts[s.training_type] ?? 0) + 1;
    }
    const sessionsByType: TypeSlice[] = Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        label: TRAINING_TYPE_LABEL[type] ?? type,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const stats: AdminStats = {
      today,
      students: {
        total: students.length,
        active: students.filter((s) => s.active).length,
      },
      coaches: {
        total: (coachRows.data ?? []).length,
        active: ((coachRows.data ?? []) as { active: boolean }[]).filter((c) => c.active).length,
      },
      groups: groups.length,
      weekSessionCount: weekSessions.length,
      todaySessions,
      upcomingSessions,
      coachMap,
      alerts: { noCoach: noCoachSessions },
      sessionsByDay,
      sessionsByType,
      newMessages,
    };

    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
