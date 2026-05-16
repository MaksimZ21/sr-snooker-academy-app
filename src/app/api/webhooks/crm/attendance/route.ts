import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { upsertAttendance } from "@/lib/sheets/attendance";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student } from "@/lib/sheets/schemas";

const CrmStatus = z.enum(["confirmed", "declined", "present", "absent"]);

const AttendanceQuery = z.object({
  event_id: z.string().min(1),
  name: z.string().min(1),
  status: CrmStatus.default("confirmed"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

  const parsed = AttendanceQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { event_id, name, status } = parsed.data;
  const attendanceStatus = (status === "confirmed" || status === "present") ? "present" : "absent";

  const { data: sessionData } = await db
    .from("sessions")
    .select("id")
    .eq("crm_event_id", event_id)
    .maybeSingle();

  if (!sessionData) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const { data: students } = await db.from("students").select("*");
  const normalizedName = name.trim().toLowerCase();
  const student = (students ?? [] as Student[]).find(
    (s) => studentFullName(s as Student).toLowerCase() === normalizedName,
  );

  if (!student) {
    return NextResponse.json({ error: "student not found", name }, { status: 404 });
  }

  await upsertAttendance({
    session_id: sessionData.id as string,
    student_id: student.id as string,
    status: attendanceStatus,
    marked_by: "crm",
    marked_at: new Date().toISOString(),
  });

  return NextResponse.json({ session_id: sessionData.id, student_id: student.id }, { status: 200 });
}
