import { db } from "@/lib/db/client";
import { isValidBracketSize, knockoutRoundCount, knockoutMatchWinner, computeEloUpdate } from "./tournament-logic";

export type KnockoutMatch = {
  id: string;
  tournament_id: string;
  round: number;
  slot: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
  next_match_id: string | null;
};

export async function fetchKnockoutBracket(tournamentId: string): Promise<KnockoutMatch[]> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("slot");
  return (data ?? []) as KnockoutMatch[];
}

export async function hasAnyKnockoutResult(tournamentId: string): Promise<boolean> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .not("frames_a", "is", null)
    .limit(1);
  return (data ?? []).length > 0;
}

// Builds the whole bracket empty (no participants assigned yet) — the
// manager fills round-1 slots afterward via assignParticipantToSlot. Safe
// to call again: it deletes the tournament's existing bracket first, so
// this doubles as "rebuild the bracket".
//
// Built from the final backwards (round = totalRounds down to 1) so every
// match's next_match_id can reference an already-created row — there's no
// way to insert a self-referencing tree in one shot with DB-generated ids.
export async function createKnockoutBracket(tournamentId: string, bracketSize: number): Promise<void> {
  if (!isValidBracketSize(bracketSize)) {
    throw new Error("bracket size must be 4, 8, 16, or 32");
  }

  const { error: deleteError } = await db
    .from("tournament_knockout_matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (deleteError) throw new Error(deleteError.message);

  const totalRounds = knockoutRoundCount(bracketSize);
  let nextRoundSlotToId: Record<number, string> = {};

  for (let round = totalRounds; round >= 1; round--) {
    const numMatches = bracketSize / 2 ** round;
    const thisRoundSlotToId: Record<number, string> = {};
    for (let slot = 0; slot < numMatches; slot++) {
      const nextMatchId = round === totalRounds ? null : (nextRoundSlotToId[Math.floor(slot / 2)] ?? null);
      const { data: row, error } = await db
        .from("tournament_knockout_matches")
        .insert({ tournament_id: tournamentId, round, slot, next_match_id: nextMatchId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      thisRoundSlotToId[slot] = row.id as string;
    }
    nextRoundSlotToId = thisRoundSlotToId;
  }
}

// Round-1 only, and only before that match has a recorded result — the
// manager is free to change their mind about who's in a slot until the
// match is actually played.
export async function assignParticipantToSlot(
  tournamentId: string,
  matchId: string,
  side: "a" | "b",
  participantId: string | null,
): Promise<void> {
  const { data: match } = await db
    .from("tournament_knockout_matches")
    .select("id, tournament_id, round, frames_a, frames_b")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.tournament_id !== tournamentId) throw new Error("match not found");
  if (match.round !== 1) throw new Error("participants can only be manually assigned in round 1");
  if (match.frames_a !== null || match.frames_b !== null) {
    throw new Error("cannot reassign a match that already has a result");
  }

  if (participantId) {
    const { data: participant } = await db
      .from("tournament_participants")
      .select("id, tournament_id")
      .eq("id", participantId)
      .maybeSingle();
    if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");
  }

  const column = side === "a" ? "participant_a_id" : "participant_b_id";
  const { error } = await db
    .from("tournament_knockout_matches")
    .update({ [column]: participantId })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// The explicit "סיים שיבוץ" action: scans every round-1 match and, for any
// one that has exactly one side filled and no result yet, advances that
// lone participant into their next match's slot. Deliberately NOT automatic
// on every assignment — the manager places participants one at a time, and
// firing this on every single assignment would prematurely advance someone
// whose opponent's slot is about to be filled a moment later. Safe to call
// more than once: matches that already have both sides filled, or already
// have a result, are simply skipped on a re-run.
export async function finalizeByes(tournamentId: string): Promise<void> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round", 1);
  const matches = (data ?? []) as KnockoutMatch[];

  for (const m of matches) {
    const hasA = m.participant_a_id !== null;
    const hasB = m.participant_b_id !== null;
    const unplayed = m.frames_a === null && m.frames_b === null;
    if (hasA !== hasB && unplayed && m.next_match_id) {
      const advancingId = hasA ? m.participant_a_id : m.participant_b_id;
      const nextSide = m.slot % 2 === 0 ? "participant_a_id" : "participant_b_id";
      const { error } = await db
        .from("tournament_knockout_matches")
        .update({ [nextSide]: advancingId })
        .eq("id", m.next_match_id);
      if (error) throw new Error(error.message);
    }
  }
}

export async function enterKnockoutMatchResult(
  tournamentId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.tournament_id !== tournamentId) throw new Error("match not found");
  if (!match.participant_a_id || !match.participant_b_id) {
    throw new Error("both participants must be set before entering a result");
  }

  const { error: updateError } = await db
    .from("tournament_knockout_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  // The route layer's zod schema already rejects a tie, so this is never
  // null in practice — reused here (rather than re-deriving "who won" a
  // second time) purely to avoid two independent "framesA > framesB"
  // comparisons drifting apart if this logic is ever touched again.
  const winnerSide = knockoutMatchWinner(framesA, framesB);
  const aWon = winnerSide === "a";

  // ELO update — same forward-only convention as house matches.
  const { data: participants } = await db
    .from("tournament_participants")
    .select("id, student_id")
    .in("id", [match.participant_a_id, match.participant_b_id]);
  const pa = participants?.find((p) => p.id === match.participant_a_id);
  const pb = participants?.find((p) => p.id === match.participant_b_id);
  if (pa && pb) {
    const { data: students } = await db
      .from("students")
      .select("id, rating")
      .in("id", [pa.student_id, pb.student_id]);
    const sa = students?.find((s) => s.id === pa.student_id);
    const sb = students?.find((s) => s.id === pb.student_id);
    if (sa && sb) {
      const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, aWon);
      const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
      if (ratingAError) throw new Error(ratingAError.message);
      const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
      if (ratingBError) throw new Error(ratingBError.message);
    }
  }

  // Auto-advance the winner into the next round's slot — no manual double
  // entry. slot % 2 determines which side of the next match this feeds
  // into (0-indexed slots pair up: 0&1 -> next slot 0, 2&3 -> next slot 1,
  // and within each pair the even slot always lands on side "a").
  if (match.next_match_id) {
    const winnerId = aWon ? match.participant_a_id : match.participant_b_id;
    const nextSide = match.slot % 2 === 0 ? "participant_a_id" : "participant_b_id";
    const { error: advanceError } = await db
      .from("tournament_knockout_matches")
      .update({ [nextSide]: winnerId })
      .eq("id", match.next_match_id);
    if (advanceError) throw new Error(advanceError.message);
  }
}
