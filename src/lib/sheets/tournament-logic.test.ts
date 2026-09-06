import { describe, it, expect } from "vitest";
import {
  shuffle,
  assignToHouses,
  generateRoundRobinPairs,
  computeHouseStandings,
  computeEloUpdate,
  computeHandicapPoints,
  formatHandicapLabel,
} from "./tournament-logic";

describe("shuffle", () => {
  it("returns a permutation of the input, not a mutation of it", () => {
    const input = ["a", "b", "c", "d", "e"];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([...input].sort());
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("assignToHouses", () => {
  it("splits participants into houses with the remainder in the first houses", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const houses = assignToHouses(ids, 4);
    expect(houses).toHaveLength(4);
    expect(houses.map((h) => h.length).sort((a, b) => b - a)).toEqual([4, 4, 3, 3]);
    expect(houses.flat().sort()).toEqual([...ids].sort());
  });

  it("handles an exact division with no remainder", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const houses = assignToHouses(ids, 4);
    expect(houses.map((h) => h.length)).toEqual([3, 3, 3, 3]);
  });
});

describe("generateRoundRobinPairs", () => {
  it("pairs every participant with every other participant exactly once", () => {
    const pairs = generateRoundRobinPairs(["a", "b", "c", "d"]);
    expect(pairs).toHaveLength(6);
    expect(pairs).toEqual([
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ]);
  });

  it("returns no pairs for a single participant", () => {
    expect(generateRoundRobinPairs(["a"])).toEqual([]);
  });
});

describe("computeHouseStandings", () => {
  it("ranks by wins, then frame difference, then frames won", () => {
    const standings = computeHouseStandings(["a", "b", "c"], [
      { participant_a_id: "a", participant_b_id: "b", frames_a: 3, frames_b: 1 },
      { participant_a_id: "a", participant_b_id: "c", frames_a: 3, frames_b: 2 },
      { participant_a_id: "b", participant_b_id: "c", frames_a: 3, frames_b: 0 },
    ]);
    expect(standings.map((s) => s.participantId)).toEqual(["a", "b", "c"]);
    expect(standings[0]).toEqual({ participantId: "a", wins: 2, framesWon: 6, framesLost: 3 });
  });

  it("excludes unplayed matches from the computation", () => {
    const standings = computeHouseStandings(["a", "b"], [
      { participant_a_id: "a", participant_b_id: "b", frames_a: null, frames_b: null },
    ]);
    expect(standings).toEqual([
      { participantId: "a", wins: 0, framesWon: 0, framesLost: 0 },
      { participantId: "b", wins: 0, framesWon: 0, framesLost: 0 },
    ]);
  });
});

describe("computeEloUpdate", () => {
  it("gives the winner more rating and the loser less, symmetrically", () => {
    const { newRatingA, newRatingB } = computeEloUpdate(1000, 1000, true);
    expect(newRatingA).toBe(1016);
    expect(newRatingB).toBe(984);
  });

  it("a big underdog winning gains more than an even match winner", () => {
    const evenWin = computeEloUpdate(1000, 1000, true);
    const underdogWin = computeEloUpdate(800, 1200, true);
    expect(underdogWin.newRatingA - 800).toBeGreaterThan(evenWin.newRatingA - 1000);
  });
});

describe("computeHandicapPoints", () => {
  it("returns positive when the first player is stronger", () => {
    expect(computeHandicapPoints(1100, 1000, 20)).toBe(5);
  });
  it("returns negative when the second player is stronger", () => {
    expect(computeHandicapPoints(1000, 1100, 20)).toBe(-5);
  });
  it("returns 0 for equal ratings", () => {
    expect(computeHandicapPoints(1000, 1000, 20)).toBe(0);
  });
});

describe("formatHandicapLabel", () => {
  it("names the stronger player as the one giving points", () => {
    expect(formatHandicapLabel("דני", 1100, "יוסי", 1000, 20)).toBe("דני נותן/ת ליוסי 5 נקודות");
    expect(formatHandicapLabel("דני", 1000, "יוסי", 1100, 20)).toBe("יוסי נותן/ת לדני 5 נקודות");
  });
  it("returns an empty string when there's no handicap", () => {
    expect(formatHandicapLabel("דני", 1000, "יוסי", 1000, 20)).toBe("");
  });
});
