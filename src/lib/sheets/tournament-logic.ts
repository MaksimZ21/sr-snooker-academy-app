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
