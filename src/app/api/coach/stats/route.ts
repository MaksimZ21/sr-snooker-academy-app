import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";
import { fetchStudents } from "@/lib/sheets/students";
import { todayIsoTel, weekRangeFor, dayLabelHe, dayLetterHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import type { Session } from "@/lib/sheets/schemas";
import type { DayBar } from "@/app/api/admin/stats/route";
import { fetchIntroEventsInRange, type IntroEventView } from "@/lib/sheets/intro-events";
import { fetchTournamentsInRange, type Tournament } from "@/lib/sheets/tournaments";

export type CoachStats = {
  today: string;
  todaySessions: Session[];
  upcomingSessions: Session[];
  // Intro events assigned to this coach: today's, and the next 7 days.
  todayIntroEvents: IntroEventView[];
  upcomingIntroEvents: IntroEventView[];
  // Today's tournaments this coach manages.
  todayTournaments: Tournament[];
  weekSessionCount: number;
  weekStudentCount: number;
  sessionsByDay: DayBar[];
  studentMap: Record<string, string>;
};

const fetchCoachStatsData = unstable_cache(
  async (coachEmail: string, today: string): Promise<CoachStats> => {
    const { startIso, endIso } = weekRangeFor(today);
    const nextWeekEnd = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

    const [todayRows, weekRows, upcomingRows, students, introEvents, todayTournaments] = await Promise.all([
      db.from("sessions").select("*").eq("coach_email", coachEmail).eq("date", today).order("start_time"),
      db.from("sessions").select("*").eq("coach_email", coachEmail).gte("date", startIso).lte("date", endIso).neq("status", "cancelled"),
      db.from("sessions").select("*").eq("coach_email", coachEmail).gt("date", today).lte("date", nextWeekEnd).neq("status", "cancelled").order("date").order("start_time").limit(15),
      fetchStudents(),
      fetchIntroEventsInRange(today, nextWeekEnd, coachEmail),
      fetchTournamentsInRange(today, today, coachEmail),
    ]);

    const studentMap: Record<string, string> = {};
    for (const s of students) {
      studentMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ");
    }

    const todaySessions = (todayRows.data ?? []) as Session[];
    const upcomingSessions = (upcomingRows.data ?? []) as Session[];
    const weekSessions = (weekRows.data ?? []) as Session[];

    const sessionsByDay: DayBar[] = Array.from({ length: 7 }, (_, i) => {
      const date = format(addDays(parseISO(startIso), i), "yyyy-MM-dd");
      return {
        date,
        day: dayLetterHe(date),
        count: weekSessions.filter((s) => s.date === date).length,
      };
    });

    const weekStudentCount = new Set(weekSessions.flatMap((s) => s.student_ids)).size;

    return {
      today,
      todaySessions,
      upcomingSessions,
      todayIntroEvents: introEvents.filter((e) => e.event_date === today),
      upcomingIntroEvents: introEvents.filter((e) => e.event_date > today),
      todayTournaments,
      weekSessionCount: weekSessions.length,
      weekStudentCount,
      sessionsByDay,
      studentMap,
    };
  },
  ["coach:stats"],
  { revalidate: 30, tags: ["coach-stats"] },
);

export async function GET() {
  try {
    const user = await requireUser();
    const stats = await fetchCoachStatsData(user.email, todayIsoTel());
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
