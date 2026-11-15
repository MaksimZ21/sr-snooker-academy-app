import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";
import type { Attendance } from "./schemas";

// Statuses the coach sets when taking attendance. confirmed/declined come
// from the CRM ahead of time, so they don't count as "attendance taken".
const MARKED_STATUSES = ["present", "absent", "late"];

// Which of these sessions already have attendance taken (at least one
// student marked present/absent/late).
export async function fetchAttendanceMarkedSessionIds(sessionIds: string[]): Promise<Set<string>> {
  const marked = new Set<string>();
  for (let i = 0; i < sessionIds.length; i += 200) {
    const chunk = sessionIds.slice(i, i + 200);
    const { data, error } = await db
      .from("attendance")
      .select("session_id")
      .in("session_id", chunk)
      .in("status", MARKED_STATUSES);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { session_id: string }[]) marked.add(row.session_id);
  }
  return marked;
}

// Adds attendance_marked to each session (for the schedule cards).
export async function withAttendanceMarked<T extends { id: string }>(
  sessions: T[],
): Promise<(T & { attendance_marked: boolean })[]> {
  const marked = await fetchAttendanceMarkedSessionIds(sessions.map((s) => s.id));
  return sessions.map((s) => ({ ...s, attendance_marked: marked.has(s.id) }));
}

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
