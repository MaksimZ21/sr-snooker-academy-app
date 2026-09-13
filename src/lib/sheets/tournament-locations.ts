import { db } from "@/lib/db/client";

export type TournamentLocation = { id: string; tournament_id: string; label: string };

export async function fetchTournamentLocations(tournamentId: string): Promise<TournamentLocation[]> {
  const { data } = await db
    .from("tournament_locations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("label");
  return (data ?? []) as TournamentLocation[];
}

export async function addTournamentLocation(tournamentId: string, label: string): Promise<TournamentLocation> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, type")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) throw new Error("tournament not found");
  if (tournament.type !== "multi_location") {
    throw new Error("locations can only be added to a multi-location tournament");
  }

  const { data, error } = await db
    .from("tournament_locations")
    .insert({ tournament_id: tournamentId, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TournamentLocation;
}

export async function assignParticipantToLocation(
  tournamentId: string,
  participantId: string,
  locationId: string | null,
): Promise<void> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, type")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) throw new Error("tournament not found");
  if (tournament.type !== "multi_location") {
    throw new Error("location assignment only applies to a multi-location tournament");
  }

  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id, house_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // A house belongs to exactly one location — changing location while the
  // participant is still placed in a house would silently disagree with
  // that house's own location. The manager must explicitly remove them
  // from their house first (removeParticipantFromHouse) — no implicit
  // cascade, same "explicit guard over silent side effects" rule already
  // used throughout this codebase's tournament/league guards.
  if (participant.house_id) {
    throw new Error(
      "cannot change location while the participant is still assigned to a house — remove them from their house first",
    );
  }

  if (locationId) {
    const { data: location } = await db
      .from("tournament_locations")
      .select("id, tournament_id")
      .eq("id", locationId)
      .maybeSingle();
    if (!location || location.tournament_id !== tournamentId) throw new Error("location not found");
  }

  const { error } = await db
    .from("tournament_participants")
    .update({ location_id: locationId })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
}
