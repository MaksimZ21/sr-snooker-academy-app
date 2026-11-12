import { SKILL_LEVELS } from "./schemas";

// The league's 12 ft level-change rules. Points are only a tracker for the
// player's level; they have nothing to do with the league table.
export const LEVEL_CHANGE_THRESHOLD = 5;
export const LEVEL_CHANGE_MIN_MATCHES = 4;

export type MatchOutcome = "win" | "loss" | "draw";
export type LevelStatus = "up" | "down" | null;

// 0 = strongest (A) ... 6 = weakest (E).
function levelIndex(level: string | null): number {
  return level ? (SKILL_LEVELS as readonly string[]).indexOf(level) : -1;
}

// How much a win or loss counts against a level gap of `gap` (>= 1).
function gapWeight(gap: number): number {
  if (gap <= 2) return 1;
  if (gap === 3) return 2;
  if (gap <= 6) return 3;
  return 4;
}

// Points for one match, from the levels both players had when it was
// played. null when either level is missing: such a match isn't counted.
export function levelChangePoints(myLevel: string | null, oppLevel: string | null, outcome: MatchOutcome): number | null {
  const me = levelIndex(myLevel);
  const opp = levelIndex(oppLevel);
  if (me < 0 || opp < 0) return null;
  if (outcome === "draw") return 0;
  // > 0: the opponent is stronger than me by that many levels.
  const oppStrongerBy = me - opp;
  if (outcome === "win") {
    if (oppStrongerBy === 0) return 0.25;
    if (oppStrongerBy < 0) return 0.5;
    return gapWeight(oppStrongerBy);
  }
  if (oppStrongerBy === 0) return -0.25;
  if (oppStrongerBy > 0) return -0.5;
  return -gapWeight(-oppStrongerBy);
}

// Never changes anything by itself: it only says whether the player is a
// candidate. A player already at A can't go up, and one at E can't go down.
export function levelStatus(level: string | null, points: number, matches: number): LevelStatus {
  const i = levelIndex(level);
  if (i < 0 || matches < LEVEL_CHANGE_MIN_MATCHES) return null;
  if (points >= LEVEL_CHANGE_THRESHOLD && i > 0) return "up";
  if (points <= -LEVEL_CHANGE_THRESHOLD && i < SKILL_LEVELS.length - 1) return "down";
  return null;
}

// One level at a time.
export function nextLevel(level: string, direction: "up" | "down"): string | null {
  const i = levelIndex(level);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  return SKILL_LEVELS[j] ?? null;
}
