import { db } from "@/lib/db/client";
import { fetchTournamentDetail } from "./tournaments";
import { fetchTournamentHouses } from "./tournament-houses";
import { fetchKnockoutBracket } from "./tournament-knockout";
import { computeTournamentPlacement } from "./tournament-logic";

export type StudentMatchEntry = {
  opponentName: string;
  framesFor: number;
  framesAgainst: number;
  won: boolean;
  stage: "house" | "knockout";
};

export type StudentTournamentEntry = {
  tournamentId: string;
  tournamentName: string;
  matches: StudentMatchEntry[];
  placement: string | null;
};

export async function fetchStudentTournamentHistory(studentId: string): Promise<StudentTournamentEntry[]> {
  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id, tournament_id")
    .eq("student_id", studentId);
  const rows = (participantRows ?? []) as { id: string; tournament_id: string }[];

  const entries = await Promise.all(rows.map((row) => buildEntry(row.tournament_id, row.id)));
  return entries.filter((e): e is StudentTournamentEntry => e !== null);
}

async function buildEntry(tournamentId: string, participantId: string): Promise<StudentTournamentEntry | null> {
  const detail = await fetchTournamentDetail(tournamentId);
  if (!detail) return null;

  const participantById = new Map(detail.participants.map((p) => [p.id, p]));
  function opponentName(otherId: string | null): string {
    if (!otherId) return "?";
    const p = participantById.get(otherId);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") || "?" : "?";
  }

  const [houses, knockoutMatches] = await Promise.all([
    fetchTournamentHouses(tournamentId),
    fetchKnockoutBracket(tournamentId),
  ]);

  const matches: StudentMatchEntry[] = [];
  const myHouse = houses.find((h) => h.memberIds.includes(participantId)) ?? null;

  for (const house of houses) {
    for (const m of house.matches) {
      if (m.frames_a === null || m.frames_b === null) continue;
      if (m.participant_a_id === participantId) {
        matches.push({
          opponentName: opponentName(m.participant_b_id),
          framesFor: m.frames_a,
          framesAgainst: m.frames_b,
          won: m.frames_a > m.frames_b,
          stage: "house",
        });
      } else if (m.participant_b_id === participantId) {
        matches.push({
          opponentName: opponentName(m.participant_a_id),
          framesFor: m.frames_b,
          framesAgainst: m.frames_a,
          won: m.frames_b > m.frames_a,
          stage: "house",
        });
      }
    }
  }

  for (const m of knockoutMatches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    if (m.participant_a_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_b_id),
        framesFor: m.frames_a,
        framesAgainst: m.frames_b,
        won: m.frames_a > m.frames_b,
        stage: "knockout",
      });
    } else if (m.participant_b_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_a_id),
        framesFor: m.frames_b,
        framesAgainst: m.frames_a,
        won: m.frames_b > m.frames_a,
        stage: "knockout",
      });
    }
  }

  const placement = computeTournamentPlacement(
    participantId,
    knockoutMatches,
    myHouse ? { memberIds: myHouse.memberIds, matches: myHouse.matches, label: myHouse.label } : null,
  );

  return { tournamentId, tournamentName: detail.tournament.name, matches, placement };
}
