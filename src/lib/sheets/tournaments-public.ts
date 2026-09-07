import { db } from "@/lib/db/client";
import { fetchTournamentHouses, type HouseWithMatches } from "./tournament-houses";
import { fetchKnockoutBracket, type KnockoutMatch } from "./tournament-knockout";

// Deliberately separate from tournaments.ts/tournament-houses.ts's own
// internal types: these shapes are what's safe to put in front of an
// unauthenticated visitor, and must never gain a field (phone, `paid`,
// email, etc.) just because an internal type happens to. Payment status
// and contact details are never selected from the database here at all,
// not just omitted from the response.

export type PublicParticipant = {
  id: string;
  name: string;
  rating: number;
  publicSlug: string | null;
};

export type PublicTournament = {
  name: string;
  rulesUrl: string | null;
  completed: boolean;
  handicapPointsPerRatingGap: number;
  participants: PublicParticipant[];
  houses: HouseWithMatches[];
  knockoutMatches: KnockoutMatch[];
};

export async function fetchPublicTournament(slug: string): Promise<PublicTournament | null> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, name, rules_url, completed, handicap_points_per_rating_gap")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!tournament) return null;

  const tournamentId = tournament.id as string;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id, student_id")
    .eq("tournament_id", tournamentId);
  const rows = (participantRows ?? []) as { id: string; student_id: string }[];

  const studentIds = rows.map((r) => r.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, rating, public_slug").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; rating: number; public_slug: string | null }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  const participants: PublicParticipant[] = rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      id: r.id,
      name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "?",
      rating: (s?.rating as number) ?? 1000,
      publicSlug: (s?.public_slug as string) ?? null,
    };
  });

  const [houses, knockoutMatches] = await Promise.all([
    fetchTournamentHouses(tournamentId),
    fetchKnockoutBracket(tournamentId),
  ]);

  return {
    name: tournament.name as string,
    rulesUrl: (tournament.rules_url as string | null) ?? null,
    completed: tournament.completed as boolean,
    handicapPointsPerRatingGap: tournament.handicap_points_per_rating_gap as number,
    participants,
    houses,
    knockoutMatches,
  };
}

export type PublicPlayerTournament = {
  name: string;
  publicSlug: string;
  completed: boolean;
};

export type PublicPlayer = {
  name: string;
  rating: number;
  tournaments: PublicPlayerTournament[];
};

export async function fetchPublicPlayer(slug: string): Promise<PublicPlayer | null> {
  const { data: student } = await db
    .from("students")
    .select("id, first_name, last_name, rating")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!student) return null;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("tournament_id")
    .eq("student_id", student.id as string);
  const tournamentIds = [...new Set((participantRows ?? []).map((r) => r.tournament_id as string))];

  const { data: tournamentRows } = tournamentIds.length
    ? await db.from("tournaments").select("name, public_slug, completed").in("id", tournamentIds)
    : { data: [] as { name: string; public_slug: string; completed: boolean }[] };

  return {
    name: [student.first_name, student.last_name].filter(Boolean).join(" "),
    rating: student.rating as number,
    tournaments: (tournamentRows ?? []).map((t) => ({
      name: t.name as string,
      publicSlug: t.public_slug as string,
      completed: t.completed as boolean,
    })),
  };
}
