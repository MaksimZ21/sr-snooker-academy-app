import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionsForCoach } from "@/lib/sheets/sessions";
import { fetchStudents } from "@/lib/sheets/students";
import { todayIsoTel, weekRangeFor, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import type { Session } from "@/lib/sheets/schemas";
import type { DayBar } from "@/app/api/admin/stats/route";

export type CoachStats = {
  today: string;
  todaySessions: Session[];
  upcomingSessions: Session[];
  weekSessionCount: number;
  weekStudentCount: number;
  sessionsByDay: DayBar[];
  studentMap: Record<string, string>;
};

export async function GET() {
  try {
    const user = await requireUser();

    const today = todayIsoTel();
    const { startIso, endIso } = weekRangeFor(today);
    const nextWeekEnd = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

    const [mySessions, students] = await Promise.all([
      fetchSessionsForCoach(user.email),
      fetchStudents(),
    ]);

    const studentMap: Record<string, string> = {};
    for (const s of students) {
      studentMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ");
    }

    const todaySessions = mySessions
      .filter((s) => s.date === today)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const upcomingSessions = mySessions
      .filter((s) => s.date > today && s.date <= nextWeekEnd && s.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .slice(0, 15);

    const weekSessions = mySessions.filter(
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

    const weekStudentCount = new Set(weekSessions.flatMap((s) => s.student_ids)).size;

    return NextResponse.json({
      today,
      todaySessions,
      upcomingSessions,
      weekSessionCount: weekSessions.length,
      weekStudentCount,
      sessionsByDay,
      studentMap,
    } satisfies CoachStats);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
