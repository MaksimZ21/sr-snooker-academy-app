import { db } from "@/lib/db/client";

export type TournamentBreak = { id: string; tournament_id: string; participant_id: string; value: number; created_at: string };

export async function fetchTournamentBreaks(tournamentId: string): Promise<TournamentBreak[]> {
  const { data } = await db.from("tournament_breaks").select("*").eq("tournament_id", tournamentId);
  return (data ?? []) as TournamentBreak[];
}

export async function addTournamentBreak(tournamentId: string, participantId: string, value: number): Promise<void> {
  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  const { error } = await db.from("tournament_breaks").insert({ tournament_id: tournamentId, participant_id: participantId, value });
  if (error) throw new Error(error.message);
}

export async function deleteTournamentBreak(tournamentId: string, breakId: string): Promise<void> {
  const { error } = await db.from("tournament_breaks").delete().eq("id", breakId).eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
}
