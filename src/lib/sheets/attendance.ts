import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Attendance } from "./schemas";

export async function fetchAttendanceForSession(sessionId: string): Promise<Attendance[]> {
  const { data } = await db
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId);
  return (data ?? []) as Attendance[];
}

export async function fetchAttendanceForStudent(studentId: string): Promise<Attendance[]> {
  const { data } = await db
    .from("attendance")
    .select("*")
    .eq("student_id", studentId);
  return (data ?? []) as Attendance[];
}

export async function upsertAttendance(row: Attendance): Promise<void> {
  await db
    .from("attendance")
    .upsert(row, { onConflict: "session_id,student_id" });
  revalidateTag("attendance:all", { expire: 0 });
  revalidateTag(`attendance:${row.session_id}`, { expire: 0 });
}
