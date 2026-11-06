import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Note } from "./schemas";

export async function fetchNotesForStudent(studentId: string): Promise<Note[]> {
  const { data } = await db
    .from("notes")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Note[];
}

// The only query a student's own pages may use: team notes never leave the
// server for them.
export async function fetchStudentVisibleNotes(studentId: string): Promise<Note[]> {
  const { data } = await db
    .from("notes")
    .select("*")
    .eq("student_id", studentId)
    .eq("visibility", "student")
    .order("created_at", { ascending: false });
  return (data ?? []) as Note[];
}

export async function fetchNotesForMultipleStudents(
  studentIds: string[],
): Promise<Record<string, Note[]>> {
  if (studentIds.length === 0) return {};
  const { data } = await db
    .from("notes")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  const result: Record<string, Note[]> = {};
  for (const id of studentIds) result[id] = [];
  for (const note of (data ?? []) as Note[]) {
    result[note.student_id].push(note);
  }
  return result;
}

// Only notes that belong to a specific session (used in session detail view)
export async function fetchNotesForSessionStudents(
  sessionId: string,
  studentIds: string[],
): Promise<Record<string, Note[]>> {
  if (studentIds.length === 0) return {};
  const { data } = await db
    .from("notes")
    .select("*")
    .eq("session_id", sessionId)
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  const result: Record<string, Note[]> = {};
  for (const id of studentIds) result[id] = [];
  for (const note of (data ?? []) as Note[]) {
    result[note.student_id].push(note);
  }
  return result;
}

export async function appendNote(row: Note): Promise<void> {
  const { error } = await db.from("notes").insert(row);
  if (error) throw new Error(error.message);
  revalidateTag("notes:all", { expire: 0 });
  revalidateTag(`notes:${row.student_id}`, { expire: 0 });
}

export async function deleteNote(sessionId: string, noteId: string): Promise<void> {
  const { data, error } = await db
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("session_id", sessionId)
    .select("student_id");
  if (error) throw new Error(error.message);
  revalidateTag("notes:all", { expire: 0 });
  for (const row of data ?? []) revalidateTag(`notes:${row.student_id}`, { expire: 0 });
}
