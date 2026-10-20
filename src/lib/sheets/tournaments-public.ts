import { db } from "@/lib/db/client";
import { fetchTournamentHouses, type HouseWithMatches } from "./tournament-houses";
import { fetchKnockoutBracket, type KnockoutMatch } from "./tournament-knockout";
import { fetchTournamentLocations, type TournamentLocation } from "./tournament-locations";

// Deliberately separate from tournaments.ts/tournament-houses.ts's own
// internal types: these shapes are what's safe to put in front of an
// unauthenticated visitor, and must never gain a field (phone, `paid`,
// email, etc.) just because an internal type happens to. Payment status
// and contact details are never selected from the database here at all,
// not just omitted from the response.
//
// Caveat: this isolation only covers this file's own four queries below.
// `fetchTournamentHouses`/`fetchKnockoutBracket`/`fetchTournamentLocations`
// (imported from the authenticated modules) do `select("*")` against
// tournament_houses/tournament_house_matches/tournament_knockout_matches/
// tournament_locations. Those tables are purely structural today (ids,
// labels, slots, frame scores) with nothing sensitive on them, so reusing
// them here is safe — but if any of them ever gains a column not meant for
// public eyes, it would flow onto this public page with no line in this
// file for a reviewer to notice. Re-audit this file if those tables'
// schemas change.

export type PublicParticipant = {
  id: string;
  name: string;
  skillLevel: string | null;
  publicSlug: string | null;
};

export type PublicTournament = {
  name: string;
  rulesUrl: string | null;
  completed: boolean;
  participants: PublicParticipant[];
  houses: HouseWithMatches[];
  knockoutMatches: KnockoutMatch[];
  // Empty for a `regular` tournament — houses render as one flat grid.
  // Non-empty only for `multi_location`, where houses group under their
  // location. No student personal-area equivalent exists for this by
  // product decision: multi-location tournament participants aren't
  // expected to be existing academy students with accounts.
  locations: TournamentLocation[];
};

export async function fetchPublicTournament(slug: string): Promise<PublicTournament | null> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, name, rules_url, completed, type")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!tournament) return null;

  const tournamentId = tournament.id as string;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id, student_id, local_name")
    .eq("tournament_id", tournamentId);
  const rows = (participantRows ?? []) as { id: string; student_id: string | null; local_name: string | null }[];

  const studentIds = rows.map((r) => r.student_id).filter((id): id is string => id !== null);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, skill_level, public_slug").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; skill_level: string | null; public_slug: string | null }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  // A local (multi-location) participant has no student row and no
  // classification — it's a plain name local to this tournament.
  const participants: PublicParticipant[] = rows.map((r) => {
    if (!r.student_id) {
      return { id: r.id, name: r.local_name ?? "?", skillLevel: null, publicSlug: null };
    }
    const s = studentsById.get(r.student_id);
    return {
      id: r.id,
      name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "?",
      skillLevel: (s?.skill_level as string | null) ?? null,
      publicSlug: (s?.public_slug as string) ?? null,
    };
  });

  const [houses, knockoutMatches, locations] = await Promise.all([
    fetchTournamentHouses(tournamentId),
    fetchKnockoutBracket(tournamentId),
    tournament.type === "multi_location" ? fetchTournamentLocations(tournamentId) : Promise.resolve([]),
  ]);

  return {
    name: tournament.name as string,
    rulesUrl: (tournament.rules_url as string | null) ?? null,
    completed: tournament.completed as boolean,
    participants,
    houses,
    knockoutMatches,
    locations,
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
