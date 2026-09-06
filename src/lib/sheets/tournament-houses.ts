import { db } from "@/lib/db/client";
import {
  assignToHouses,
  generateRoundRobinPairs,
  computeEloUpdate,
} from "./tournament-logic";

export type House = { id: string; tournament_id: string; label: string };
export type HouseMatch = {
  id: string;
  house_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};
export type HouseWithMatches = House & { matches: HouseMatch[]; memberIds: string[] };

export async function fetchTournamentHouses(tournamentId: string): Promise<HouseWithMatches[]> {
  const { data: houses } = await db
    .from("tournament_houses")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("label");
  const houseRows = (houses ?? []) as House[];
  if (!houseRows.length) return [];

  const houseIds = houseRows.map((h) => h.id);
  const { data: matches } = await db.from("tournament_house_matches").select("*").in("house_id", houseIds);
  const { data: members } = await db.from("tournament_participants").select("id, house_id").in("house_id", houseIds);

  return houseRows.map((h) => ({
    ...h,
    matches: (matches ?? []).filter((m) => m.house_id === h.id) as HouseMatch[],
    memberIds: (members ?? []).filter((m) => m.house_id === h.id).map((m) => m.id as string),
  }));
}

export async function hasAnyHouseResult(tournamentId: string): Promise<boolean> {
  const { data: houses } = await db.from("tournament_houses").select("id").eq("tournament_id", tournamentId);
  const houseIds = (houses ?? []).map((h) => h.id as string);
  if (!houseIds.length) return false;
  const { data: played } = await db
    .from("tournament_house_matches")
    .select("id")
    .in("house_id", houseIds)
    .not("frames_a", "is", null)
    .limit(1);
  return (played ?? []).length > 0;
}

export async function runHouseDraw(tournamentId: string, numHouses: number): Promise<void> {
  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId);
  const participantIds = (participantRows ?? []).map((p) => p.id as string);
  if (participantIds.length === 0) throw new Error("no participants to draw");
  if (numHouses < 1) throw new Error("numHouses must be at least 1");
  if (numHouses > participantIds.length) throw new Error("numHouses cannot exceed participant count");

  // Deleting existing houses cascades their tournament_house_matches and
  // (via ON DELETE SET NULL on tournament_participants.house_id) frees up
  // every participant who was in one of them — this is what makes calling
  // this same function again a safe "re-draw", not just an initial draw.
  const { error: deleteError } = await db.from("tournament_houses").delete().eq("tournament_id", tournamentId);
  if (deleteError) throw new Error(deleteError.message);

  const groups = assignToHouses(participantIds, numHouses);

  for (let i = 0; i < groups.length; i++) {
    const { data: house, error: houseError } = await db
      .from("tournament_houses")
      .insert({ tournament_id: tournamentId, label: `בית ${i + 1}` })
      .select()
      .single();
    if (houseError) throw new Error(houseError.message);
    const houseId = house.id as string;
    const memberIds = groups[i];

    if (memberIds.length) {
      const { error: assignError } = await db
        .from("tournament_participants")
        .update({ house_id: houseId })
        .in("id", memberIds);
      if (assignError) throw new Error(assignError.message);
    }

    const pairs = generateRoundRobinPairs(memberIds).map(([a, b]) => ({
      house_id: houseId,
      participant_a_id: a,
      participant_b_id: b,
      frames_a: null,
      frames_b: null,
    }));
    if (pairs.length) {
      const { error: matchError } = await db.from("tournament_house_matches").insert(pairs);
      if (matchError) throw new Error(matchError.message);
    }
  }
}

export async function moveParticipantToHouse(
  tournamentId: string,
  participantId: string,
  newHouseId: string,
): Promise<void> {
  const { data: house } = await db
    .from("tournament_houses")
    .select("id, tournament_id")
    .eq("id", newHouseId)
    .maybeSingle();
  if (!house || house.tournament_id !== tournamentId) throw new Error("house not found");

  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id, house_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // Already in the target house — nothing to do, and definitely don't wipe
  // and regenerate that house's fixtures for no reason.
  if (participant.house_id === newHouseId) return;

  // A participant only ever belongs to one house at a time, so this looks
  // at every match they're currently in (regardless of which house). If
  // any of them already has a recorded result, refuse the move — silently
  // deleting a played match's result would lose real data with no way to
  // recover it.
  const { data: existingMatches } = await db
    .from("tournament_house_matches")
    .select("frames_a")
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);
  const hasPlayedMatch = (existingMatches ?? []).some((m) => m.frames_a !== null);
  if (hasPlayedMatch) {
    throw new Error("cannot move a participant who has already played a match in their current house");
  }

  const { error: deleteError } = await db
    .from("tournament_house_matches")
    .delete()
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);
  if (deleteError) throw new Error(deleteError.message);

  const { error: updateError } = await db
    .from("tournament_participants")
    .update({ house_id: newHouseId })
    .eq("id", participantId);
  if (updateError) throw new Error(updateError.message);

  const { data: houseMates } = await db
    .from("tournament_participants")
    .select("id")
    .eq("house_id", newHouseId)
    .neq("id", participantId);

  const pairs = (houseMates ?? []).map((m) => ({
    house_id: newHouseId,
    participant_a_id: participantId,
    participant_b_id: m.id as string,
    frames_a: null,
    frames_b: null,
  }));
  if (pairs.length) {
    const { error: insertError } = await db.from("tournament_house_matches").insert(pairs);
    if (insertError) throw new Error(insertError.message);
  }
}

export async function enterHouseMatchResult(
  tournamentId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db.from("tournament_house_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("match not found");

  const { data: house } = await db
    .from("tournament_houses")
    .select("id, tournament_id")
    .eq("id", match.house_id)
    .maybeSingle();
  if (!house || house.tournament_id !== tournamentId) throw new Error("match not found");

  const { error: updateError } = await db
    .from("tournament_house_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  const { data: participants } = await db
    .from("tournament_participants")
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
  // players' ratings are RIGHT NOW, not the ratings at the time of the
  // original entry — matching the spec's explicit "no retroactive
  // recalculation" rule (every save is a fresh, forward-only ELO update).
  const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, framesA > framesB);
  const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
  if (ratingAError) throw new Error(ratingAError.message);
  const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
  if (ratingBError) throw new Error(ratingBError.message);
}
