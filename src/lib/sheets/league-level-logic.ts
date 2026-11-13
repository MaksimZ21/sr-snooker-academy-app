import { SKILL_LEVELS } from "./schemas";

// The league's 12 ft level-change rules. Points are only a tracker for the
// player's level; they have nothing to do with the league table.
export const LEVEL_CHANGE_THRESHOLD = 5;
export const LEVEL_CHANGE_MIN_MATCHES = 4;

export type MatchOutcome = "win" | "loss" | "draw";
export type LevelStatus = "up" | "down" | null;

// `levels` is the 12 ft list from the settings page, best first.
type Levels = readonly string[];

// 0 = strongest ... last = weakest.
function levelIndex(level: string | null, levels: Levels): number {
  return level ? levels.indexOf(level) : -1;
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
export function levelChangePoints(
  myLevel: string | null,
  oppLevel: string | null,
  outcome: MatchOutcome,
  levels: Levels = SKILL_LEVELS,
): number | null {
  const me = levelIndex(myLevel, levels);
  const opp = levelIndex(oppLevel, levels);
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
// candidate. A player at the top can't go up, and one at the bottom can't go down.
export function levelStatus(
  level: string | null,
  points: number,
  matches: number,
  levels: Levels = SKILL_LEVELS,
): LevelStatus {
  const i = levelIndex(level, levels);
  if (i < 0 || matches < LEVEL_CHANGE_MIN_MATCHES) return null;
  if (points >= LEVEL_CHANGE_THRESHOLD && i > 0) return "up";
  if (points <= -LEVEL_CHANGE_THRESHOLD && i < levels.length - 1) return "down";
  return null;
}

// One level at a time.
export function nextLevel(level: string, direction: "up" | "down", levels: Levels = SKILL_LEVELS): string | null {
  const i = levelIndex(level, levels);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  return levels[j] ?? null;
}
