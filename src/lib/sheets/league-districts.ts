import { db } from "@/lib/db/client";
import { generateLeagueRounds, computeEloUpdate } from "./tournament-logic";

export type LeagueDistrict = { id: string; league_id: string; label: string };

export type LeagueMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};

export type DistrictWithMatches = LeagueDistrict & { matches: LeagueMatch[]; memberIds: string[] };

export async function fetchLeagueDistricts(leagueId: string): Promise<DistrictWithMatches[]> {
  const { data: districts } = await db
    .from("league_districts")
    .select("*")
    .eq("league_id", leagueId)
    .order("label");
  const districtRows = (districts ?? []) as LeagueDistrict[];
  if (!districtRows.length) return [];

  const districtIds = districtRows.map((d) => d.id);
  const { data: matches } = await db.from("league_matches").select("*").in("district_id", districtIds);
  const { data: members } = await db
    .from("league_participants")
    .select("id, district_id")
    .in("district_id", districtIds);

  return districtRows.map((d) => ({
    ...d,
    matches: (matches ?? []).filter((m) => m.district_id === d.id) as LeagueMatch[],
    memberIds: (members ?? []).filter((m) => m.district_id === d.id).map((m) => m.id as string),
  }));
}

export async function districtHasFixtures(districtId: string): Promise<boolean> {
  const { data } = await db.from("league_matches").select("id").eq("district_id", districtId).limit(1);
  return (data ?? []).length > 0;
}

export async function addLeagueDistrict(leagueId: string, label: string): Promise<LeagueDistrict> {
  const { data, error } = await db
    .from("league_districts")
    .insert({ league_id: leagueId, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LeagueDistrict;
}

export async function assignParticipantToDistrict(
  leagueId: string,
  participantId: string,
  districtId: string | null,
): Promise<void> {
  const { data: participant } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.league_id !== leagueId) throw new Error("participant not found");

  if (districtId) {
    const { data: district } = await db
      .from("league_districts")
      .select("id, league_id")
      .eq("id", districtId)
      .maybeSingle();
    if (!district || district.league_id !== leagueId) throw new Error("district not found");
    if (await districtHasFixtures(districtId)) {
      throw new Error("cannot assign a participant into a district whose fixture schedule was already generated");
    }
  }

  if (participant.district_id && (await districtHasFixtures(participant.district_id as string))) {
    throw new Error("cannot move a participant out of a district whose fixture schedule was already generated");
  }

  const { error } = await db
    .from("league_participants")
    .update({ district_id: districtId })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function generateDistrictFixtures(leagueId: string, districtId: string): Promise<void> {
  const { data: district } = await db
    .from("league_districts")
    .select("id, league_id")
    .eq("id", districtId)
    .maybeSingle();
  if (!district || district.league_id !== leagueId) throw new Error("district not found");

  const { data: existingResults } = await db
    .from("league_matches")
    .select("id")
    .eq("district_id", districtId)
    .not("frames_a", "is", null)
    .limit(1);
  if ((existingResults ?? []).length > 0) {
    throw new Error("cannot regenerate a fixture schedule once results have been recorded");
  }

  const { error: deleteError } = await db.from("league_matches").delete().eq("district_id", districtId);
  if (deleteError) throw new Error(deleteError.message);

  const { data: memberRows } = await db
    .from("league_participants")
    .select("id")
    .eq("league_id", leagueId)
    .eq("district_id", districtId);
  const participantIds = (memberRows ?? []).map((m) => m.id as string);
  if (participantIds.length < 2) throw new Error("a district needs at least 2 participants to generate fixtures");

  const { data: league } = await db.from("leagues").select("num_cycles").eq("id", leagueId).maybeSingle();
  const numCycles = (league?.num_cycles as number) ?? 1;

  const fixtures = generateLeagueRounds(participantIds, numCycles);
  const rows = fixtures.map((f) => ({
    district_id: districtId,
    round: f.round,
    participant_a_id: f.participantAId,
    participant_b_id: f.participantBId,
    frames_a: null,
    frames_b: null,
  }));
  if (rows.length) {
    const { error: insertError } = await db.from("league_matches").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
}

export async function enterLeagueMatchResult(
  leagueId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db.from("league_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("match not found");

  const { data: district } = await db
    .from("league_districts")
    .select("id, league_id")
    .eq("id", match.district_id)
    .maybeSingle();
  if (!district || district.league_id !== leagueId) throw new Error("match not found");

  const { error: updateError } = await db
    .from("league_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  const { data: participants } = await db
    .from("league_participants")
    .select("id, student_id")
    .in("id", [match.participant_a_id, match.participant_b_id]);
  const pa = participants?.find((p) => p.id === match.participant_a_id);
  const pb = participants?.find((p) => p.id === match.participant_b_id);
  if (!pa || !pb) return;

  const { data: students } = await db
    .from("students")
    .select("id, rating")
    .in("id", [pa.student_id, pb.student_id]);
  const sa = students?.find((s) => s.id === pa.student_id);
  const sb = students?.find((s) => s.id === pb.student_id);
  if (!sa || !sb) return;

  // Re-entering a corrected result recalculates from whatever the two
  // players' ratings are RIGHT NOW — matching the exact same forward-only,
  // no-retroactive-recalculation rule already established for tournament
  // house/knockout results.
  const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, framesA > framesB);
  const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
  if (ratingAError) throw new Error(ratingAError.message);
  const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
  if (ratingBError) throw new Error(ratingBError.message);
}
