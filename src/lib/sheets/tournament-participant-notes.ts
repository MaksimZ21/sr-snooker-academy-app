import { db } from "@/lib/db/client";

// Staff only. Kept out of fetchTournamentDetail on purpose: that one also
// feeds the student's own tournament page.
export const PARTICIPANT_NOTE_MAX_LENGTH = 200;

export async function fetchParticipantNotes(tournamentId: string): Promise<Record<string, string>> {
  const { data, error } = await db
    .from("tournament_participant_notes")
    .select("participant_id, text")
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.participant_id as string, r.text as string]));
}

// An empty text removes the note.
export async function setParticipantNote(
  tournamentId: string,
  participantId: string,
  text: string,
  updatedBy: string,
): Promise<void> {
  const clean = text.trim();
  const { error } = clean
    ? await db.from("tournament_participant_notes").upsert(
        {
          participant_id: participantId,
          tournament_id: tournamentId,
          text: clean,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "participant_id" },
      )
    : await db
        .from("tournament_participant_notes")
        .delete()
        .eq("participant_id", participantId)
        .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
}
