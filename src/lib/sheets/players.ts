import { db } from "@/lib/db/client";
import { studentFullName } from "@/lib/sheets/schemas";

export type Player = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  tournamentsPlayed: number;
  publicSlug: string;
};

export async function fetchPlayers(): Promise<Player[]> {
  const { data: studentRows } = await db
    .from("students")
    .select("id, first_name, last_name, phone, rating, public_slug")
    .not("public_slug", "is", null);
  const students = (studentRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    rating: number;
    public_slug: string;
  }[];

  const studentIds = students.map((s) => s.id);
  const { data: participantRows } = studentIds.length
    ? await db.from("tournament_participants").select("student_id").in("student_id", studentIds)
    : { data: [] as { student_id: string }[] };

  const countByStudentId = new Map<string, number>();
  for (const row of participantRows ?? []) {
    const id = row.student_id as string;
    countByStudentId.set(id, (countByStudentId.get(id) ?? 0) + 1);
  }

  return students
    .map((s) => ({
      id: s.id,
      name: studentFullName(s),
      phone: s.phone ?? "",
      rating: s.rating,
      tournamentsPlayed: countByStudentId.get(s.id) ?? 0,
      publicSlug: s.public_slug,
    }))
    .sort((a, b) => b.rating - a.rating);
}
