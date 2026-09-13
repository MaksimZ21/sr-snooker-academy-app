const ELO_K = 32;

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignToHouses(participantIds: string[], numHouses: number): string[][] {
  const shuffled = shuffle(participantIds);
  const houses: string[][] = Array.from({ length: numHouses }, () => []);
  shuffled.forEach((id, i) => houses[i % numHouses].push(id));
  return houses;
}

export function generateRoundRobinPairs(participantIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      pairs.push([participantIds[i], participantIds[j]]);
    }
  }
  return pairs;
}

export type HouseStandingRow = { participantId: string; wins: number; framesWon: number; framesLost: number };

export function computeHouseStandings(
  participantIds: string[],
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[],
): HouseStandingRow[] {
  const rows = new Map<string, HouseStandingRow>(
    participantIds.map((id) => [id, { participantId: id, wins: 0, framesWon: 0, framesLost: 0 }]),
  );
  for (const m of matches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    const a = rows.get(m.participant_a_id);
    const b = rows.get(m.participant_b_id);
    if (!a || !b) continue;
    a.framesWon += m.frames_a;
    a.framesLost += m.frames_b;
    b.framesWon += m.frames_b;
    b.framesLost += m.frames_a;
    if (m.frames_a > m.frames_b) a.wins += 1;
    else if (m.frames_b > m.frames_a) b.wins += 1;
  }
  return [...rows.values()].sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const xDiff = x.framesWon - x.framesLost;
    const yDiff = y.framesWon - y.framesLost;
    if (yDiff !== xDiff) return yDiff - xDiff;
    return y.framesWon - x.framesWon;
  });
}

export function computeEloUpdate(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): { newRatingA: number; newRatingB: number } {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreA = aWon ? 1 : 0;
  const scoreB = aWon ? 0 : 1;
  return {
    newRatingA: Math.round(ratingA + ELO_K * (scoreA - expectedA)),
    newRatingB: Math.round(ratingB + ELO_K * (scoreB - expectedB)),
  };
}

export function computeHandicapPoints(ratingA: number, ratingB: number, pointsPerGap: number): number {
  return Math.round((ratingA - ratingB) / pointsPerGap);
}

export function formatHandicapLabel(
  nameA: string,
  ratingA: number,
  nameB: string,
  ratingB: number,
  pointsPerGap: number,
): string {
  const diff = computeHandicapPoints(ratingA, ratingB, pointsPerGap);
  if (diff === 0) return "";
  if (diff > 0) return `${nameA} נותן/ת ל${nameB} ${diff} נקודות`;
  return `${nameB} נותן/ת ל${nameA} ${-diff} נקודות`;
}

const VALID_BRACKET_SIZES = [4, 8, 16, 32];

export function isValidBracketSize(size: number): boolean {
  return VALID_BRACKET_SIZES.includes(size);
}

export function knockoutRoundCount(bracketSize: number): number {
  return Math.log2(bracketSize);
}

// Names the last few rounds the way players actually talk about them; earlier
// rounds fall back to a plain number. Matches the exact same naming already
// used in the spec's placement-computation section ("הודח/ה בחצי הגמר" etc.).
export function knockoutRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "גמר";
  if (fromEnd === 1) return "חצי גמר";
  if (fromEnd === 2 && totalRounds >= 4) return "רבע גמר";
  return `סיבוב ${round}`;
}

type PlacementKnockoutMatch = {
  round: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
};

type PlacementHouse = {
  memberIds: string[];
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[];
  label: string;
};

/**
 * Computes a player's final placement in one tournament from already-stored
 * match results — no stored "result" field, this is pure read-time derivation.
 * See docs/superpowers/specs/2026-08-11-tournaments-design.md, "Placement
 * computation", for the full algorithm this implements.
 */
export function computeTournamentPlacement(
  participantId: string,
  knockoutMatches: PlacementKnockoutMatch[],
  house: PlacementHouse | null,
): string | null {
  const playedKnockout = knockoutMatches.filter(
    (m) =>
      (m.participant_a_id === participantId || m.participant_b_id === participantId) &&
      m.frames_a !== null &&
      m.frames_b !== null,
  );

  if (playedKnockout.length > 0) {
    const totalRounds = Math.max(...knockoutMatches.map((m) => m.round));
    const last = playedKnockout.reduce((a, b) => (b.round > a.round ? b : a));
    const won =
      (last.participant_a_id === participantId && last.frames_a! > last.frames_b!) ||
      (last.participant_b_id === participantId && last.frames_b! > last.frames_a!);

    if (won && last.round === totalRounds) return "זכה/תה בטורניר";
    if (!won && last.round === totalRounds) return "מקום 2";
    if (!won && last.round === totalRounds - 1) return "הודח/ה בחצי הגמר";
    if (!won && last.round === totalRounds - 2) return "הודח/ה ברבע הגמר";
    if (!won) return `הודח/ה בסיבוב ${last.round}`;
    // Won their last-played match but haven't played the next round yet —
    // still in progress, not eliminated and not yet champion.
    return null;
  }

  if (house) {
    const anyPlayed = house.matches.some((m) => m.frames_a !== null && m.frames_b !== null);
    if (!anyPlayed) return null;
    const standings = computeHouseStandings(house.memberIds, house.matches);
    const idx = standings.findIndex((s) => s.participantId === participantId);
    return idx === -1 ? null : `מקום ${idx + 1} ב${house.label}`;
  }

  return null;
}

type PlacementDistrict = {
  memberIds: string[];
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[];
  label: string;
};

/**
 * Computes a player's current standing within one league district from
 * already-stored match results — no stored "placement" field, this is pure
 * read-time derivation, same philosophy as computeTournamentPlacement.
 * Simpler than the tournament version: a league has no knockout stage, so
 * a placement is always just "current position in the district table,"
 * computable as soon as at least one match in that district has a result.
 */
export function computeLeaguePlacement(participantId: string, district: PlacementDistrict): string | null {
  const anyPlayed = district.matches.some((m) => m.frames_a !== null && m.frames_b !== null);
  if (!anyPlayed) return null;
  const standings = computeHouseStandings(district.memberIds, district.matches);
  const idx = standings.findIndex((s) => s.participantId === participantId);
  return idx === -1 ? null : `מקום ${idx + 1} ב${district.label}`;
}

export function knockoutMatchWinner(
  framesA: number | null,
  framesB: number | null,
): "a" | "b" | null {
  if (framesA === null || framesB === null) return null;
  if (framesA === framesB) return null;
  return framesA > framesB ? "a" : "b";
}

export type LeagueFixture = { round: number; participantAId: string; participantBId: string };

/**
 * Schedules a round-robin season for one district: every pair meets exactly
 * `numCycles` times, no participant plays twice in the same round, and
 * round numbers are unique and sequential across the whole district (cycle
 * 2 continues numbering where cycle 1 left off — it does not restart at 1).
 *
 * Standard "circle method": one participant fixed, the rest rotate each
 * round. An odd participant count gets one bye slot per round (dropped,
 * never a real fixture) so the rotation still works.
 */
export function generateLeagueRounds(participantIds: string[], numCycles: number): LeagueFixture[] {
  if (participantIds.length < 2) return [];

  const ids: (string | null)[] = [...participantIds];
  if (ids.length % 2 !== 0) ids.push(null);

  const n = ids.length;
  const roundsPerCycle = n - 1;
  const half = n / 2;
  const fixtures: LeagueFixture[] = [];

  for (let cycle = 0; cycle < numCycles; cycle++) {
    let rotation = [...ids];
    for (let r = 0; r < roundsPerCycle; r++) {
      const round = cycle * roundsPerCycle + r + 1;
      for (let i = 0; i < half; i++) {
        const a = rotation[i];
        const b = rotation[n - 1 - i];
        if (a !== null && b !== null) {
          fixtures.push({ round, participantAId: a, participantBId: b });
        }
      }
      // Keep the first participant fixed, rotate everyone else by one
      // position — the standard circle-method rotation step.
      rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
    }
  }

  return fixtures;
}
