import { db } from "@/lib/db/client";
import { fetchLeagueDistricts, type DistrictWithMatches } from "./league-districts";

// Deliberately separate from leagues.ts's own internal types, mirroring the
// same isolation `tournaments-public.ts` keeps from `tournaments.ts`: these
// shapes are what's safe to put in front of an unauthenticated visitor, and
// must never gain a field (phone, email, manager_email, etc.) just because
// an internal type happens to. Phone/manager details are never selected
// from the database here at all, not just omitted from the response.
//
// Caveat: this isolation only covers this file's own two queries below.
// `fetchLeagueDistricts` (imported from the authenticated module) does
// `select("*")` against league_districts/league_matches. Those tables are
// purely structural today (ids, labels, rounds, slots, frame scores) with
// nothing sensitive on them, so reusing it here is safe — but if either
// table ever gains a column not meant for public eyes, it would flow onto
// this public page with no line in this file for a reviewer to notice.
// Re-audit this file if those tables' schemas change.

export type PublicLeagueParticipant = {
  id: string;
  name: string;
  rating: number;
  publicSlug: string | null;
};

export type PublicLeague = {
  name: string;
  completed: boolean;
  handicapPointsPerRatingGap: number;
  participants: PublicLeagueParticipant[];
  districts: DistrictWithMatches[];
};

export async function fetchPublicLeague(slug: string): Promise<PublicLeague | null> {
  const { data: league } = await db
    .from("leagues")
    .select("id, name, completed, handicap_points_per_rating_gap")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!league) return null;

  const leagueId = league.id as string;

  const { data: participantRows } = await db
    .from("league_participants")
    .select("id, student_id")
    .eq("league_id", leagueId);
  const rows = (participantRows ?? []) as { id: string; student_id: string }[];

  const studentIds = rows.map((r) => r.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, rating, public_slug").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; rating: number; public_slug: string | null }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  const participants: PublicLeagueParticipant[] = rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      id: r.id,
      name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "?",
      rating: (s?.rating as number) ?? 1000,
      publicSlug: (s?.public_slug as string) ?? null,
    };
  });

  const districts = await fetchLeagueDistricts(leagueId);

  return {
    name: league.name as string,
    completed: league.completed as boolean,
    handicapPointsPerRatingGap: league.handicap_points_per_rating_gap as number,
    participants,
    districts,
  };
}
