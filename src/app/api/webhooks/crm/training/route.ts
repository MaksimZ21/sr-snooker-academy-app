import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertSessionFromCrm, fetchSessionByCrmAppointmentId } from "@/lib/sheets/sessions";
import { upsertAttendance } from "@/lib/sheets/attendance";
import {
  upsertTournamentFromCrm,
  fetchTournamentByCrmAppointmentId,
  addTournamentParticipantFromCrm,
} from "@/lib/sheets/tournaments";
import { db } from "@/lib/db/client";
import type { Student } from "@/lib/sheets/schemas";
import { logWebhook } from "@/lib/sheets/webhook-log";
import { getCrmPaused } from "@/lib/sheets/settings";

// The CRM's exact signal that a calendar event is a tournament, not a
// training session — see docs/superpowers/specs/2026-09-18-crm-tournament-events-design.md.
const TOURNAMENT_MEETING_TYPE = "טורניר";

function normalizePhone(raw: string): { local: string; intl: string } {
  const d = raw.replace(/\D/g, "");
  const core = d.startsWith("972") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  return { local: `0${core}`, intl: `972${core}` };
}

async function findStudentByPhone(phone: string): Promise<Student | null> {
  const { local, intl } = normalizePhone(phone);
  const { data } = await db
    .from("students")
    .select("*")
    .or(`phone.eq.${local},phone.eq.${intl}`)
    .maybeSingle();
  return (data as Student) ?? null;
}

function parseMeetingTime(raw: string): { date: string; startTime: string } | null {
  const [datePart, timePart] = raw.trim().split(" ");
  if (!datePart || !timePart) return null;
  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) return null;
  return {
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    startTime: timePart,
  };
}

const BasePayload = z.object({
  event_type: z.string(),
  event_id: z.string().min(1),
  appointment_id: z.string().min(1),
  meeting_time: z.string().min(1),
  meeting_type: z.string().default(""),
  meeting_title: z.string().optional(),
});

const AppointmentApprovedPayload = BasePayload.extend({
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
});

async function handleEventCreated(raw: Record<string, unknown>) {
  const parsed = BasePayload.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "training", event_type: "event_created", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { event_id, appointment_id, meeting_time, meeting_type, meeting_title } = parsed.data;
  const time = parseMeetingTime(meeting_time);
  if (!time) {
    void logWebhook({ route: "training", event_type: "event_created", params: raw, status: "invalid", result: { reason: "invalid meeting_time" } });
    return NextResponse.json({ error: "invalid meeting_time format, expected DD/MM/YYYY HH:MM" }, { status: 422 });
  }

  // A tournament-flavored calendar event never becomes a session — it
  // becomes a real tournament instead, ready for an admin to fill in the
  // manager afterward.
  if (meeting_type === TOURNAMENT_MEETING_TYPE) {
    const result = await upsertTournamentFromCrm({
      crm_event_id: event_id,
      crm_appointment_id: appointment_id,
      name: meeting_title || meeting_type,
      event_date: time.date,
      crm_event_type: "event_created",
    });
    void logWebhook({ route: "training", event_type: "event_created", params: raw, status: "ok", result });
    return NextResponse.json(result, { status: 200 });
  }

  const result = await upsertSessionFromCrm({
    crm_event_id: event_id,
    crm_appointment_id: appointment_id,
    name: meeting_title || meeting_type || undefined,
    date: time.date,
    start_time: time.startTime,
    end_time: "",
    group_name: meeting_title || meeting_type || undefined,
    crm_event_type: "event_created",
  });
  void logWebhook({ route: "training", event_type: "event_created", params: raw, status: "ok", result });
  return NextResponse.json(result, { status: 200 });
}

async function handleAppointmentApproved(raw: Record<string, unknown>) {
  const parsed = AppointmentApprovedPayload.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "training", event_type: "appointment_approved", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { appointment_id, phone, first_name, last_name } = parsed.data;

  const session = await fetchSessionByCrmAppointmentId(appointment_id);
  if (!session) {
    // Not a session — maybe this appointment_id belongs to a tournament
    // instead (someone bought a ticket to it through the CRM).
    const tournament = await fetchTournamentByCrmAppointmentId(appointment_id);
    if (!tournament) {
      void logWebhook({ route: "training", event_type: "appointment_approved", params: raw, status: "not_found", result: { reason: "session/tournament not found", appointment_id } });
      return NextResponse.json({ ok: true, warning: "session not found" }, { status: 200 });
    }

    const student = phone ? await findStudentByPhone(phone) : null;
    const result = await addTournamentParticipantFromCrm(tournament.id, {
      studentId: student?.id ?? null,
      firstName: first_name,
      lastName: last_name,
      phone,
    });
    void logWebhook({ route: "training", event_type: "appointment_approved", params: raw, status: "ok", result: { tournament_id: tournament.id, ...result } });
    return NextResponse.json({ ok: true, tournament_id: tournament.id, ...result });
  }

  const student = phone ? await findStudentByPhone(phone) : null;
  if (!student) {
    void logWebhook({ route: "training", event_type: "appointment_approved", params: raw, status: "not_found", result: { reason: "student not found by phone", phone } });
    return NextResponse.json({ ok: true, warning: "student not found" }, { status: 200 });
  }

  await upsertAttendance({
    session_id: session.id,
    student_id: student.id,
    status: "confirmed",
    marked_by: "crm",
    marked_at: new Date().toISOString(),
  });

  void logWebhook({ route: "training", event_type: "appointment_approved", params: raw, status: "ok", result: { session_id: session.id, student_id: student.id } });
  return NextResponse.json({ ok: true, session_id: session.id, student_id: student.id });
}

async function handleAppointmentRejected(raw: Record<string, unknown>) {
  const parsed = AppointmentApprovedPayload.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "training", event_type: "appointment_rejected", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { appointment_id, phone } = parsed.data;

  const session = await fetchSessionByCrmAppointmentId(appointment_id);
  if (!session) {
    void logWebhook({ route: "training", event_type: "appointment_rejected", params: raw, status: "not_found", result: { reason: "session not found", appointment_id } });
    return NextResponse.json({ ok: true, warning: "session not found" }, { status: 200 });
  }

  const student = phone ? await findStudentByPhone(phone) : null;
  if (!student) {
    void logWebhook({ route: "training", event_type: "appointment_rejected", params: raw, status: "not_found", result: { reason: "student not found by phone", phone } });
    return NextResponse.json({ ok: true, warning: "student not found" }, { status: 200 });
  }

  await upsertAttendance({
    session_id: session.id,
    student_id: student.id,
    status: "absent",
    marked_by: "crm",
    marked_at: new Date().toISOString(),
  });

  void logWebhook({ route: "training", event_type: "appointment_rejected", params: raw, status: "ok", result: { session_id: session.id, student_id: student.id } });
  return NextResponse.json({ ok: true, session_id: session.id, student_id: student.id });
}

async function handle(raw: Record<string, unknown>) {
  if (await getCrmPaused()) {
    return NextResponse.json({ ok: true, paused: true });
  }
  const eventType = String(raw.event_type ?? "");
  if (eventType === "event_created") return handleEventCreated(raw);
  if (eventType === "appointment_approved") return handleAppointmentApproved(raw);
  if (eventType === "appointment_rejected") return handleAppointmentRejected(raw);
  void logWebhook({ route: "training", event_type: eventType || "unknown", params: raw, status: "skipped" });
  return NextResponse.json({ ok: true, skipped: true, event_type: eventType });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    return await handle(Object.fromEntries(searchParams.entries()));
  } catch (e) {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const { searchParams } = new URL(req.url);
      body = Object.fromEntries(searchParams.entries());
    }
    return await handle(body);
  } catch (e) {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
