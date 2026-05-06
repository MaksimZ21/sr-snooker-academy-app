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

export async function appendNote(row: Note): Promise<void> {
  await db.from("notes").insert(row);
  revalidateTag("notes:all", { expire: 0 });
  revalidateTag(`notes:${row.student_id}`, { expire: 0 });
}
