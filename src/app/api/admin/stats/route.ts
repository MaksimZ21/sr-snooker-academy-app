import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchSessionsAll } from "@/lib/sheets/sessions";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { db } from "@/lib/db/client";
import { todayIsoTel, weekRangeFor } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import type { Session } from "@/lib/sheets/schemas";

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
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const today = todayIsoTel();
    const { startIso, endIso } = weekRangeFor(today);
    const nextWeekEnd = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

    const [students, sessions, groups, coachRows] = await Promise.all([
      fetchStudents(),
      fetchSessionsAll(),
      fetchGroupsAll(),
      db.from("coaches").select("email, name, active"),
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
      weekSessionCount: sessions.filter((s) => s.date >= startIso && s.date <= endIso).length,
      todaySessions,
      upcomingSessions,
      coachMap,
      alerts: { noCoach: noCoachSessions },
    };

    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
