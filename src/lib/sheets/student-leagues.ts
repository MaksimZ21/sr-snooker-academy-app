import { db } from "@/lib/db/client";
import { fetchLeagueDetail } from "./leagues";
import { fetchLeagueDistricts } from "./league-districts";
import { computeLeaguePlacement } from "./tournament-logic";

export type StudentLeagueMatchEntry = {
  opponentName: string;
  framesFor: number;
  framesAgainst: number;
  won: boolean;
};

export type StudentLeagueEntry = {
  leagueId: string;
  leagueName: string;
  districtLabel: string | null;
  matches: StudentLeagueMatchEntry[];
  placement: string | null;
};

export async function fetchStudentLeagueHistory(studentId: string): Promise<StudentLeagueEntry[]> {
  const { data: participantRows } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("student_id", studentId);
  const rows = (participantRows ?? []) as { id: string; league_id: string; district_id: string | null }[];

  const entries = await Promise.all(rows.map((row) => buildEntry(row.league_id, row.id, row.district_id)));
  return entries.filter((e): e is StudentLeagueEntry => e !== null);
}

async function buildEntry(
  leagueId: string,
  participantId: string,
  districtId: string | null,
): Promise<StudentLeagueEntry | null> {
  const detail = await fetchLeagueDetail(leagueId);
  if (!detail) return null;

  // Not yet assigned to a district — nothing to schedule or show yet, but
  // the league still shows up so the student knows they're registered.
  if (!districtId) {
    return { leagueId, leagueName: detail.league.name, districtLabel: null, matches: [], placement: null };
  }

  const districts = await fetchLeagueDistricts(leagueId);
  const myDistrict = districts.find((d) => d.id === districtId);
  if (!myDistrict) {
    return { leagueId, leagueName: detail.league.name, districtLabel: null, matches: [], placement: null };
  }

  const participantById = new Map(detail.participants.map((p) => [p.id, p]));
  function opponentName(otherId: string): string {
    const p = participantById.get(otherId);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") || "?" : "?";
  }

  const matches: StudentLeagueMatchEntry[] = [];
  for (const m of myDistrict.matches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    if (m.participant_a_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_b_id),
        framesFor: m.frames_a,
        framesAgainst: m.frames_b,
        won: m.frames_a > m.frames_b,
      });
    } else if (m.participant_b_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_a_id),
        framesFor: m.frames_b,
        framesAgainst: m.frames_a,
        won: m.frames_b > m.frames_a,
      });
    }
  }

  const placement = computeLeaguePlacement(participantId, {
    memberIds: myDistrict.memberIds,
    matches: myDistrict.matches,
    label: myDistrict.label,
  });

  return { leagueId, leagueName: detail.league.name, districtLabel: myDistrict.label, matches, placement };
}
