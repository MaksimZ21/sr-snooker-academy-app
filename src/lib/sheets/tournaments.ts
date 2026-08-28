import { db } from "@/lib/db/client";

export type Tournament = {
  id: string;
  name: string;
  manager_email: string;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  created_at: string;
};

export type TournamentParticipantWithStudent = TournamentParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

export type TournamentDetail = {
  tournament: Tournament;
  participants: TournamentParticipantWithStudent[];
};

export function isTournamentManager(tournament: Tournament, user: { email: string; role: string }): boolean {
  return user.role === "admin" || tournament.manager_email.toLowerCase() === user.email.toLowerCase();
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data } = await db.from("tournaments").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Tournament[];
}

export async function fetchTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const { data: tournament } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return null;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", id)
    .order("created_at", { ascending: true });

  const participants = (participantRows ?? []) as TournamentParticipant[];
  const studentIds = participants.map((p) => p.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone, rating").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string; rating: number }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    tournament: tournament as Tournament,
    participants: participants.map((p) => ({
      ...p,
      student: studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "", rating: 1000 },
    })),
  };
}

export async function createTournament(input: {
  name: string;
  manager_email: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
}): Promise<Tournament> {
  const { generatePublicSlug } = await import("./tournaments-slug");
  const { data, error } = await db
    .from("tournaments")
    .insert({
      name: input.name,
      manager_email: input.manager_email,
      rules_url: input.rules_url ?? null,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}

export async function updateTournament(
  id: string,
  input: {
    name?: string;
    manager_email?: string;
    rules_url?: string | null;
    handicap_points_per_rating_gap?: number;
    completed?: boolean;
  },
): Promise<void> {
  const { error } = await db.from("tournaments").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}
