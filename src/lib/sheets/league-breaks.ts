import { db } from "@/lib/db/client";

export type LeagueBreak = { id: string; league_id: string; participant_id: string; value: number; created_at: string };

export async function fetchLeagueBreaks(leagueId: string): Promise<LeagueBreak[]> {
  const { data } = await db.from("league_breaks").select("*").eq("league_id", leagueId);
  return (data ?? []) as LeagueBreak[];
}

export async function addLeagueBreak(leagueId: string, participantId: string, value: number): Promise<void> {
  const { data: participant } = await db
    .from("league_participants")
    .select("id, league_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.league_id !== leagueId) throw new Error("participant not found");

  const { error } = await db.from("league_breaks").insert({ league_id: leagueId, participant_id: participantId, value });
  if (error) throw new Error(error.message);
}

export async function deleteLeagueBreak(leagueId: string, breakId: string): Promise<void> {
  const { error } = await db.from("league_breaks").delete().eq("id", breakId).eq("league_id", leagueId);
  if (error) throw new Error(error.message);
}
