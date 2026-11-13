import { db } from "@/lib/db/client";
import { generateLeagueRounds, computeEloUpdate, missingFixtures } from "./tournament-logic";
import { fetchHandicapDistricts, type HandicapDistrict } from "./handicap";

export type LeagueDistrict = {
  id: string;
  league_id: string;
  label: string;
  num_cycles: number;
  handicap_district_id: string | null;
};

export type LeagueMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  scheduled_date: string | null;
};

// `handicap` is the district's handicap table from the settings page.
export type DistrictWithMatches = LeagueDistrict & {
  matches: LeagueMatch[];
  memberIds: string[];
  handicap: HandicapDistrict | null;
};

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
  const handicaps = districtRows.some((d) => d.handicap_district_id)
    ? await fetchHandicapDistricts().catch(() => [] as HandicapDistrict[])
    : [];

  return districtRows.map((d) => ({
    ...d,
    matches: (matches ?? []).filter((m) => m.district_id === d.id) as LeagueMatch[],
    memberIds: (members ?? []).filter((m) => m.district_id === d.id).map((m) => m.id as string),
    handicap: handicaps.find((h) => h.id === d.handicap_district_id) ?? null,
  }));
}

export async function districtHasFixtures(districtId: string): Promise<boolean> {
  const { data } = await db.from("league_matches").select("id").eq("district_id", districtId).limit(1);
  return (data ?? []).length > 0;
}

export async function addLeagueDistrict(
  leagueId: string,
  label: string,
  numCycles: number,
  handicapDistrictId: string | null = null,
): Promise<LeagueDistrict> {
  const { data, error } = await db
    .from("league_districts")
    .insert({ league_id: leagueId, label, num_cycles: numCycles, handicap_district_id: handicapDistrictId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LeagueDistrict;
}

// Links (or unlinks, with null) a league district to a handicap table.
export async function setDistrictHandicap(
  leagueId: string,
  districtId: string,
  handicapDistrictId: string | null,
): Promise<void> {
  const { error } = await db
    .from("league_districts")
    .update({ handicap_district_id: handicapDistrictId })
    .eq("id", districtId)
    .eq("league_id", leagueId);
  if (error) throw new Error(error.message);
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
  }

  const fromDistrict = (participant.district_id as string | null) ?? null;
  if (fromDistrict === districtId) return;
  if (fromDistrict && (await participantHasResults(fromDistrict, participantId))) {
    throw new Error("לשחקן כבר יש תוצאות במחוז הזה, אי אפשר להעביר אותו");
  }

  const { error } = await db
    .from("league_participants")
    .update({ district_id: districtId })
    .eq("id", participantId);
  if (error) throw new Error(error.message);

  // The district's matches follow its members automatically.
  if (fromDistrict) await syncDistrictFixtures(fromDistrict);
  if (districtId) await syncDistrictFixtures(districtId);
}

export async function participantHasResults(districtId: string, participantId: string): Promise<boolean> {
  const { data } = await db
    .from("league_matches")
    .select("id")
    .eq("district_id", districtId)
    .not("frames_a", "is", null)
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`)
    .limit(1);
  return (data ?? []).length > 0;
}

// Keeps a district's matches in line with its members: every pair of
// members meets num_cycles times. A new member gets the missing matches; a
// member who left loses their unplayed ones. Matches with a result, and
// every scheduled date, are never touched. (Matches are no longer shown by
// round, so new ones all get round 1.)
export async function syncDistrictFixtures(districtId: string): Promise<void> {
  const { data: district } = await db
    .from("league_districts")
    .select("id, num_cycles")
    .eq("id", districtId)
    .maybeSingle();
  if (!district) return;
  const cycles = district.num_cycles as number;

  const [{ data: memberRows }, { data: matchRows }] = await Promise.all([
    db.from("league_participants").select("id").eq("district_id", districtId).order("created_at"),
    db.from("league_matches").select("id, participant_a_id, participant_b_id, frames_a").eq("district_id", districtId),
  ]);
  const members = (memberRows ?? []).map((m) => m.id as string);
  const memberSet = new Set(members);
  const matches = (matchRows ?? []) as { id: string; participant_a_id: string; participant_b_id: string; frames_a: number | null }[];

  const stale = matches
    .filter((m) => m.frames_a === null && (!memberSet.has(m.participant_a_id) || !memberSet.has(m.participant_b_id)))
    .map((m) => m.id);
  if (stale.length) {
    const { error } = await db.from("league_matches").delete().in("id", stale);
    if (error) throw new Error(error.message);
  }

  const kept = matches.filter((m) => !stale.includes(m.id));
  const rows = missingFixtures(members, kept, cycles).map(([a, b]) => ({
    district_id: districtId,
    round: 1,
    participant_a_id: a,
    participant_b_id: b,
  }));
  if (rows.length) {
    const { error } = await db.from("league_matches").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function generateDistrictFixtures(leagueId: string, districtId: string): Promise<void> {
  const { data: district } = await db
    .from("league_districts")
    .select("id, league_id, num_cycles")
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

  // Validate before deleting — a district that fails this check must be
  // left exactly as it was, not wiped with nothing to rebuild.
  const { data: memberRows } = await db
    .from("league_participants")
    .select("id")
    .eq("league_id", leagueId)
    .eq("district_id", districtId);
  const participantIds = (memberRows ?? []).map((m) => m.id as string);
  if (participantIds.length < 2) throw new Error("a district needs at least 2 participants to generate fixtures");

  const { error: deleteError } = await db.from("league_matches").delete().eq("district_id", districtId);
  if (deleteError) throw new Error(deleteError.message);

  // Each district runs its own number of cycles — districts in the same
  // league are independent competitions and aren't required to repeat the
  // same number of times as one another.
  const fixtures = generateLeagueRounds(participantIds, district.num_cycles as number);
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

  const { data: participants } = await db
    .from("league_participants")
    .select("id, student_id")
    .in("id", [match.participant_a_id, match.participant_b_id]);
  const pa = participants?.find((p) => p.id === match.participant_a_id);
  const pb = participants?.find((p) => p.id === match.participant_b_id);

  const { data: students } = pa && pb
    ? await db.from("students").select("id, rating, skill_level").in("id", [pa.student_id, pb.student_id])
    : { data: [] as { id: string; rating: number; skill_level: string | null }[] };
  const sa = pa ? students?.find((s) => s.id === pa.student_id) : undefined;
  const sb = pb ? students?.find((s) => s.id === pb.student_id) : undefined;

  // The 12 ft levels both players have right now, kept on the match for
  // level-change tracking (see league-levels.ts).
  const { error: updateError } = await db
    .from("league_matches")
    .update({
      frames_a: framesA,
      frames_b: framesB,
      level_a: (sa?.skill_level as string | null) ?? null,
      level_b: (sb?.skill_level as string | null) ?? null,
      result_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  if (!sa || !sb) return;

  // Re-entering a corrected result recalculates from whatever the two
  // players' ratings are RIGHT NOW — matching the exact same forward-only,
  // no-retroactive-recalculation rule already established for tournament
  // house/knockout results.
  const { newRatingA, newRatingB } = computeEloUpdate(
    sa.rating as number,
    sb.rating as number,
    framesA === framesB ? "draw" : framesA > framesB,
  );
  const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
  if (ratingAError) throw new Error(ratingAError.message);
  const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
  if (ratingBError) throw new Error(ratingBError.message);
}

// Sets (or clears, with date: null) the play date of league matches.
// Everything is validated before anything is written, so a bad id in a
// pasted batch doesn't leave half the week scheduled.
export async function scheduleLeagueMatches(
  leagueId: string,
  assignments: { matchId: string; date: string | null }[],
): Promise<void> {
  if (assignments.length === 0) return;

  const { data: districtRows } = await db.from("league_districts").select("id").eq("league_id", leagueId);
  const districtIds = new Set((districtRows ?? []).map((d) => d.id as string));

  const { data: matchRows } = await db
    .from("league_matches")
    .select("id, district_id, frames_a")
    .in("id", assignments.map((a) => a.matchId));
  const matchesById = new Map((matchRows ?? []).map((m) => [m.id as string, m]));

  for (const a of assignments) {
    const m = matchesById.get(a.matchId);
    if (!m || !districtIds.has(m.district_id as string)) throw new Error("match not found");
    if (m.frames_a !== null) throw new Error("cannot reschedule a match that was already played");
  }

  for (const a of assignments) {
    const { error } = await db.from("league_matches").update({ scheduled_date: a.date }).eq("id", a.matchId);
    if (error) throw new Error(error.message);
  }
}
