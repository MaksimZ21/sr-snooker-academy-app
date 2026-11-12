import { db } from "@/lib/db/client";
import { levelChangePoints, levelStatus, nextLevel, type LevelStatus } from "./league-level-logic";

export type LeagueLevelRow = {
  studentId: string;
  name: string;
  level: string | null;
  points: number;
  matches: number;
  status: LevelStatus;
  nextLevel: string | null;
};

type MatchRow = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  level_a: string | null;
  level_b: string | null;
  result_at: string | null;
};

// Level-change points for these players, from every league match (any
// league that isn't 9-10 ft) whose result was entered after the player's
// last 12 ft level change. Each match counts with the levels both players
// had when its result was entered.
export async function fetchLevelTracking(studentIds: string[]): Promise<Record<string, LeagueLevelRow>> {
  if (!studentIds.length) return {};

  const { data: studentRows } = await db
    .from("students")
    .select("id, first_name, last_name, skill_level, skill_level_changed_at")
    .in("id", studentIds);
  const students = (studentRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    skill_level: string | null;
    skill_level_changed_at: string | null;
  }[];

  const { data: participantRows } = await db
    .from("league_participants")
    .select("id, student_id, league_id")
    .in("student_id", studentIds);
  const participants = (participantRows ?? []) as { id: string; student_id: string; league_id: string }[];

  const leagueIds = [...new Set(participants.map((p) => p.league_id))];
  const { data: leagueRows } = leagueIds.length
    ? await db.from("leagues").select("id, table_size").in("id", leagueIds)
    : { data: [] as { id: string; table_size: string | null }[] };
  const nineFootLeagues = new Set(
    ((leagueRows ?? []) as { id: string; table_size: string | null }[])
      .filter((l) => l.table_size === "9-10")
      .map((l) => l.id),
  );
  const studentByParticipant = new Map(
    participants.filter((p) => !nineFootLeagues.has(p.league_id)).map((p) => [p.id, p.student_id]),
  );
  const participantIds = [...studentByParticipant.keys()];

  const matches = new Map<string, MatchRow>();
  if (participantIds.length) {
    const cols = "id, participant_a_id, participant_b_id, frames_a, frames_b, level_a, level_b, result_at";
    const [{ data: asA }, { data: asB }] = await Promise.all([
      db.from("league_matches").select(cols).in("participant_a_id", participantIds).not("result_at", "is", null),
      db.from("league_matches").select(cols).in("participant_b_id", participantIds).not("result_at", "is", null),
    ]);
    for (const m of [...(asA ?? []), ...(asB ?? [])] as MatchRow[]) matches.set(m.id, m);
  }

  const totals = new Map<string, { points: number; matches: number }>();
  const changedAt = new Map(students.map((s) => [s.id, s.skill_level_changed_at]));
  for (const m of matches.values()) {
    if (m.frames_a === null || m.frames_b === null || !m.result_at) continue;
    for (const side of ["a", "b"] as const) {
      const studentId = studentByParticipant.get(side === "a" ? m.participant_a_id : m.participant_b_id);
      if (!studentId) continue;
      const since = changedAt.get(studentId);
      if (since && m.result_at <= since) continue;
      const mine = side === "a" ? m.frames_a : m.frames_b;
      const theirs = side === "a" ? m.frames_b : m.frames_a;
      const outcome = mine === theirs ? "draw" : mine > theirs ? "win" : "loss";
      const pts = levelChangePoints(side === "a" ? m.level_a : m.level_b, side === "a" ? m.level_b : m.level_a, outcome);
      if (pts === null) continue;
      const t = totals.get(studentId) ?? { points: 0, matches: 0 };
      totals.set(studentId, { points: t.points + pts, matches: t.matches + 1 });
    }
  }

  return Object.fromEntries(
    students.map((s) => {
      const t = totals.get(s.id) ?? { points: 0, matches: 0 };
      const points = Math.round(t.points * 100) / 100;
      const status = levelStatus(s.skill_level, points, t.matches);
      return [
        s.id,
        {
          studentId: s.id,
          name: [s.first_name, s.last_name].filter(Boolean).join(" "),
          level: s.skill_level,
          points,
          matches: t.matches,
          status,
          nextLevel: status && s.skill_level ? nextLevel(s.skill_level, status) : null,
        },
      ];
    }),
  );
}

// Applies an approved change: only when the player is a candidate right
// now, and only one level. The DB trigger stamps skill_level_changed_at,
// which restarts the count from zero.
export async function applyLevelChange(studentId: string): Promise<string> {
  const row = (await fetchLevelTracking([studentId]))[studentId];
  if (!row?.status || !row.nextLevel) throw new Error("השחקן לא מועמד לשינוי דרגה כרגע");
  const { error } = await db.from("students").update({ skill_level: row.nextLevel }).eq("id", studentId);
  if (error) throw new Error(error.message);
  return row.nextLevel;
}
