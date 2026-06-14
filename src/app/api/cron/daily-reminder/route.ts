import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { todayIsoTel } from "@/lib/date";
import { fetchSessionsTodayAll } from "@/lib/sheets/sessions";
import { fetchAttendanceForSession } from "@/lib/sheets/attendance";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";
import type { Session } from "@/lib/sheets/schemas";

type CoachRow = { email: string; name: string; phone: string };
type StudentRow = { id: string; first_name: string; last_name: string };

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const today = todayIsoTel();
    const sessions = await fetchSessionsTodayAll(today);
    const active = sessions.filter((s) => s.coach_email && s.status !== "cancelled");

    if (active.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Confirmed student IDs per session
    const confirmedBySession: Record<string, string[]> = {};
    await Promise.all(
      active.map(async (s) => {
        const rows = await fetchAttendanceForSession(s.id);
        confirmedBySession[s.id] = rows
          .filter((a) => a.status === "confirmed")
          .map((a) => a.student_id);
      }),
    );

    // Resolve student names
    const allStudentIds = [...new Set(Object.values(confirmedBySession).flat())];
    const studentMap: Record<string, string> = {};
    if (allStudentIds.length > 0) {
      const { data } = await db
        .from("students")
        .select("id, first_name, last_name")
        .in("id", allStudentIds);
      for (const s of (data ?? []) as StudentRow[]) {
        studentMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ");
      }
    }

    // Group sessions by coach
    const byCoach: Record<string, Session[]> = {};
    for (const s of active) {
      byCoach[s.coach_email] ??= [];
      byCoach[s.coach_email].push(s);
    }

    // Coach phone numbers
    const { data: coachData } = await db
      .from("coaches")
      .select("email, name, phone")
      .in("email", Object.keys(byCoach));
    const coachMap: Record<string, CoachRow> = {};
    for (const c of (coachData ?? []) as CoachRow[]) {
      coachMap[c.email] = c;
    }

    let sent = 0;
    for (const [email, coachSessions] of Object.entries(byCoach)) {
      const coach = coachMap[email];
      if (!coach?.phone) continue;

      const lines: string[] = [`שלום ${coach.name}! 👋`, `תזכורת לאימונים שלך היום:`, ""];

      for (const s of coachSessions.sort((a, b) => a.start_time.localeCompare(b.start_time))) {
        const label = s.name || s.training_type;
        lines.push(`⏰ ${s.start_time} — ${label}`);
        const confirmed = confirmedBySession[s.id] ?? [];
        if (confirmed.length > 0) {
          lines.push("מתאמנים שאישרו:");
          for (const id of confirmed) lines.push(`• ${studentMap[id] ?? id}`);
        } else {
          lines.push("אין אישורי הגעה עדיין");
        }
        lines.push("");
      }

      await sendWhatsAppMessage(coach.phone, lines.join("\n").trim());
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error("[cron/daily-reminder]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
