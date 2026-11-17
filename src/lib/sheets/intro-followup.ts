import { db } from "@/lib/db/client";
import { sendIntroFollowupTemplate } from "@/lib/whatsapp/meta-cloud";

export const FOLLOWUP_HOUR = 12;

// The event date whose participants are due a follow-up right now:
// yesterday (Israel time), once it's past 12:00 today. Before that, none.
export function followupEventDate(now: Date): string | null {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  if (Number(parts.hour) < FOLLOWUP_HOUR) return null;
  const yesterday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return yesterday.toISOString().slice(0, 10);
}

type Pending = { id: string; student_id: string };
type StudentRow = { id: string; first_name: string; phone: string };

async function finish(id: string, status: "sent" | "failed", error: string | null) {
  await db.from("intro_event_participants").update({ followup_status: status, followup_error: error }).eq("id", id);
}

// Called from the WhatsApp cron. Each participant is claimed atomically
// (status NULL -> 'sending') before sending, so overlapping cron runs never
// send twice. A failure is recorded, not retried.
export async function sendDueIntroFollowups(now = new Date()): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  const date = followupEventDate(now);
  if (!date) return result;

  const { data: events } = await db
    .from("intro_events")
    .select("id")
    .eq("event_date", date)
    .eq("followup_enabled", true);
  const eventIds = (events ?? []).map((e) => e.id as string);
  if (!eventIds.length) return result;

  const { data: pendingRows } = await db
    .from("intro_event_participants")
    .select("id, student_id")
    .in("intro_event_id", eventIds)
    .is("followup_status", null);
  const pending = (pendingRows ?? []) as Pending[];
  if (!pending.length) return result;

  const { data: studentRows } = await db
    .from("students")
    .select("id, first_name, phone")
    .in("id", pending.map((p) => p.student_id));
  const students = new Map(((studentRows ?? []) as StudentRow[]).map((s) => [s.id, s]));

  for (const p of pending) {
    const { data: claimed } = await db
      .from("intro_event_participants")
      .update({ followup_status: "sending", followup_at: now.toISOString() })
      .eq("id", p.id)
      .is("followup_status", null)
      .select("id");
    if (!claimed?.length) continue;

    const student = students.get(p.student_id);
    if (!student?.phone) {
      await finish(p.id, "failed", "אין מספר טלפון");
      result.failed++;
      continue;
    }
    try {
      await sendIntroFollowupTemplate(student.phone, student.first_name ?? "");
      await finish(p.id, "sent", null);
      result.sent++;
    } catch (e) {
      console.error("[intro-followup]", p.id, e);
      await finish(p.id, "failed", (e instanceof Error ? e.message : String(e)).slice(0, 300));
      result.failed++;
    }
  }
  return result;
}
