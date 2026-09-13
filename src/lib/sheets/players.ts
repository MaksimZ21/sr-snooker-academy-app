import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { studentFullName } from "@/lib/sheets/schemas";
import { generatePublicSlug } from "@/lib/sheets/tournaments-slug";

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

/**
 * Gives a student a public player profile if they don't already have one —
 * the exact same lazy slug generation that happens automatically the first
 * time a student is added to a tournament, but callable directly (e.g. from
 * an admin action on a student who hasn't played a tournament yet). Purely
 * additive: touches only public_slug, nothing else on the student record.
 * Idempotent and race-safe via the `.is("public_slug", null)` guard.
 */
export async function ensurePlayerSlug(studentId: string): Promise<void> {
  const { data: existing } = await db.from("students").select("public_slug").eq("id", studentId).maybeSingle();
  if (existing && !existing.public_slug) {
    await db.from("students").update({ public_slug: generatePublicSlug() }).eq("id", studentId).is("public_slug", null);
    // fetchStudents() is unstable_cache-wrapped under the "students" tag —
    // without this, the admin UI (student detail page, students list) can
    // keep showing the old null public_slug for up to its 5-minute TTL.
    revalidateTag("students", { expire: 0 });
  }
}
