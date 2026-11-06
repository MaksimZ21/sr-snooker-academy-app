import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import type { Attendance } from "./schemas";

export async function fetchAttendanceForSession(sessionId: string): Promise<Attendance[]> {
  const { data } = await db
    .from("attendance")
    .select("*")
    .eq("session_id", sessionId);
  return (data ?? []) as Attendance[];
}

export const fetchAttendanceForStudent = unstable_cache(
  async (studentId: string): Promise<Attendance[]> => {
    const { data } = await db
      .from("attendance")
      .select("*")
      .eq("student_id", studentId);
    return (data ?? []) as Attendance[];
  },
  ["attendance:student"],
  { revalidate: 120, tags: ["attendance:all"] },
);

export async function upsertAttendance(row: Attendance): Promise<void> {
  const { error } = await db
    .from("attendance")
    .upsert(row, { onConflict: "session_id,student_id" });
  if (error) throw new Error(error.message);
  revalidateTag("attendance:all", { expire: 0 });
  revalidateTag(`attendance:${row.session_id}`, { expire: 0 });
}

// A coach can clear only what is marked in the room; the student's own
// confirmed/declined answer stays unless an admin clears it.
export async function deleteAttendance(sessionId: string, studentId: string, onlyStatuses?: string[]): Promise<void> {
  let request = db.from("attendance").delete().eq("session_id", sessionId).eq("student_id", studentId);
  if (onlyStatuses) request = request.in("status", onlyStatuses);
  const { error } = await request;
  if (error) throw new Error(error.message);
  revalidateTag("attendance:all", { expire: 0 });
  revalidateTag(`attendance:${sessionId}`, { expire: 0 });
}
