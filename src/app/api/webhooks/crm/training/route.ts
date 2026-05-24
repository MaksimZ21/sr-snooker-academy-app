import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertSessionFromCrm, fetchSessionByCrmAppointmentId } from "@/lib/sheets/sessions";
import { upsertAttendance } from "@/lib/sheets/attendance";
import { db } from "@/lib/db/client";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student } from "@/lib/sheets/schemas";

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
});

const AppointmentApprovedPayload = BasePayload.extend({
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
});

async function handleEventCreated(raw: Record<string, unknown>) {
  const parsed = BasePayload.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { event_id, appointment_id, meeting_time, meeting_type } = parsed.data;
  const time = parseMeetingTime(meeting_time);
  if (!time) {
    return NextResponse.json({ error: "invalid meeting_time format, expected DD/MM/YYYY HH:MM" }, { status: 422 });
  }
  const result = await upsertSessionFromCrm({
    crm_event_id: event_id,
    crm_appointment_id: appointment_id,
    date: time.date,
    start_time: time.startTime,
    end_time: "",
    group_name: meeting_type || undefined,
    crm_event_type: "event_created",
  });
  return NextResponse.json(result, { status: 200 });
}

async function handleAppointmentApproved(raw: Record<string, unknown>) {
  const parsed = AppointmentApprovedPayload.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { appointment_id, first_name, last_name, phone } = parsed.data;

  const session = await fetchSessionByCrmAppointmentId(appointment_id);
  if (!session) {
    console.warn(`[crm/training] session not found for appointment_id=${appointment_id}`);
    return NextResponse.json({ ok: true, warning: "session not found" }, { status: 200 });
  }

  // Find student by phone first, then by full name
  let student: Student | null = null;
  if (phone) {
    const { data } = await db.from("students").select("*").eq("phone", phone.trim()).maybeSingle();
    if (data) student = data as Student;
  }
  if (!student) {
    const fullName = [first_name, last_name].filter(Boolean).join(" ").trim().toLowerCase();
    const { data: all } = await db.from("students").select("*");
    student = ((all ?? []) as Student[]).find(
      (s) => studentFullName(s).toLowerCase() === fullName,
    ) ?? null;
  }

  if (!student) {
    console.warn(`[crm/training] student not found: phone=${phone}, name=${first_name} ${last_name}`);
    return NextResponse.json({ ok: true, warning: "student not found" }, { status: 200 });
  }

  await upsertAttendance({
    session_id: session.id,
    student_id: student.id,
    status: "confirmed",
    marked_by: "crm",
    marked_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, session_id: session.id, student_id: student.id });
}

async function handle(raw: Record<string, unknown>) {
  console.log("[crm/training] received:", JSON.stringify(raw));
  const eventType = String(raw.event_type ?? "");
  if (eventType === "event_created") return handleEventCreated(raw);
  if (eventType === "appointment_approved") return handleAppointmentApproved(raw);
  return NextResponse.json({ ok: true, skipped: true, event_type: eventType });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    return await handle(Object.fromEntries(searchParams.entries()));
  } catch (e) {
    console.error("[crm/training] error", e);
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
    console.error("[crm/training] error", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
