import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { db } from "@/lib/db/client";
import { todayIsoTel, weekRangeFor, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";
import { countNewContactRequests } from "@/lib/sheets/contact";
import type { Session } from "@/lib/sheets/schemas";

export type DayBar = { date: string; day: string; count: number };
export type TypeSlice = { type: string; label: string; count: number };

export type AbsentStudent = { id: string; name: string };
export type PaymentDueStudent = { id: string; name: string };

export type AdminStats = {
  today: string;
  students: { total: number; active: number };
  coaches: { total: number; active: number };
  groups: number;
  weekSessionCount: number;
  todaySessions: Session[];
  upcomingSessions: Session[];
  coachMap: Record<string, string>;
  alerts: { noCoach: Session[]; absentStudents: AbsentStudent[]; paymentDue: PaymentDueStudent[] };
  sessionsByDay: DayBar[];
  sessionsByType: TypeSlice[];
  newMessages: number;
};

const fetchAdminStatsData = unstable_cache(
  async (today: string): Promise<AdminStats> => {
    const { startIso, endIso } = weekRangeFor(today);
    const nextWeekEnd = format(addDays(parseISO(today), 7), "yyyy-MM-dd");

    const past21 = format(addDays(parseISO(today), -21), "yyyy-MM-dd");
    const paymentCutoff = format(addDays(parseISO(today), -30), "yyyy-MM-dd");

    const [
      students,
      todayRows,
      weekRows,
      upcomingRows,
      noCoachRows,
      groups,
      coachRows,
      newMessages,
      recentSessionRows,
    ] = await Promise.all([
      fetchStudents(),
      db.from("sessions").select("*").eq("date", today).order("start_time"),
      db.from("sessions").select("*").gte("date", startIso).lte("date", endIso).neq("status", "cancelled"),
      db.from("sessions").select("*").gt("date", today).lte("date", nextWeekEnd).neq("status", "cancelled").order("date").order("start_time").limit(20),
      db.from("sessions").select("*").eq("coach_email", "").gte("date", today).eq("status", "scheduled").order("date").limit(10),
      fetchGroupsAll(),
      db.from("coaches").select("email, name, active"),
      countNewContactRequests(),
      db.from("sessions").select("id, student_ids").gte("date", past21).lte("date", today).neq("status", "cancelled"),
    ]);

    const coachMap: Record<string, string> = {};
    for (const c of (coachRows.data ?? []) as { email: string; name: string }[]) {
      coachMap[c.email] = c.name;
    }

    // Absent students: scheduled in last 21 days but never present/late
    const recentSessions = (recentSessionRows.data ?? []) as { id: string; student_ids: string[] }[];
    const scheduledIds = new Set<string>();
    const recentSessionIds: string[] = [];
    for (const s of recentSessions) {
      recentSessionIds.push(s.id);
      for (const sid of s.student_ids ?? []) scheduledIds.add(sid);
    }
    let absentStudents: AbsentStudent[] = [];
    if (recentSessionIds.length > 0 && scheduledIds.size > 0) {
      const { data: presentRows } = await db
        .from("attendance")
        .select("student_id")
        .in("session_id", recentSessionIds)
        .in("status", ["present", "late"]);
      const presentIds = new Set((presentRows ?? []).map((r) => r.student_id as string));
      const absentIds = [...scheduledIds].filter((id) => !presentIds.has(id));
      absentStudents = students
        .filter((s) => absentIds.includes(s.id) && s.active)
        .map((s) => ({ id: s.id, name: [s.first_name, s.last_name].filter(Boolean).join(" ") }));
    }

    const todaySessions = (todayRows.data ?? []) as Session[];
    const upcomingSessions = (upcomingRows.data ?? []) as Session[];
    const noCoachSessions = (noCoachRows.data ?? []) as Session[];
    const weekSessions = (weekRows.data ?? []) as Session[];

    const paymentDue: PaymentDueStudent[] = students
      .filter((s) => s.active && (!s.last_payment_date || s.last_payment_date < paymentCutoff))
      .map((s) => ({ id: s.id, name: [s.first_name, s.last_name].filter(Boolean).join(" ") }));

    const sessionsByDay: DayBar[] = Array.from({ length: 7 }, (_, i) => {
      const date = format(addDays(parseISO(startIso), i), "yyyy-MM-dd");
      return {
        date,
        day: dayLabelHe(date).slice(0, 3),
        count: weekSessions.filter((s) => s.date === date).length,
      };
    });

    const typeCounts: Record<string, number> = {};
    for (const s of weekSessions) {
      typeCounts[s.training_type] = (typeCounts[s.training_type] ?? 0) + 1;
    }
    const sessionsByType: TypeSlice[] = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, label: TRAINING_TYPE_LABEL[type] ?? type, count }))
      .sort((a, b) => b.count - a.count);

    return {
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
      alerts: { noCoach: noCoachSessions, absentStudents, paymentDue },
      sessionsByDay,
      sessionsByType,
      newMessages,
    };
  },
  ["admin:stats"],
  { revalidate: 30, tags: ["admin-stats"] },
);

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const stats = await fetchAdminStatsData(todayIsoTel());
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
