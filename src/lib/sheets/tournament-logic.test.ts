import { describe, it, expect } from "vitest";
import {
  shuffle,
  assignToHouses,
  generateRoundRobinPairs,
  computeHouseStandings,
  computeEloUpdate,
  computeHandicapPoints,
  formatHandicapLabel,
  isValidBracketSize,
  knockoutRoundCount,
  knockoutRoundLabel,
  knockoutMatchWinner,
  computeTournamentPlacement,
  generateLeagueRounds,
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

describe("isValidBracketSize", () => {
  it("accepts the four supported sizes", () => {
    expect(isValidBracketSize(4)).toBe(true);
    expect(isValidBracketSize(8)).toBe(true);
    expect(isValidBracketSize(16)).toBe(true);
    expect(isValidBracketSize(32)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidBracketSize(2)).toBe(false);
    expect(isValidBracketSize(6)).toBe(false);
    expect(isValidBracketSize(64)).toBe(false);
    expect(isValidBracketSize(0)).toBe(false);
  });
});

describe("knockoutRoundCount", () => {
  it("computes log2 of the bracket size", () => {
    expect(knockoutRoundCount(4)).toBe(2);
    expect(knockoutRoundCount(8)).toBe(3);
    expect(knockoutRoundCount(16)).toBe(4);
    expect(knockoutRoundCount(32)).toBe(5);
  });
});

describe("knockoutRoundLabel", () => {
  it("names the final and semi-final specially", () => {
    expect(knockoutRoundLabel(3, 3)).toBe("גמר");
    expect(knockoutRoundLabel(2, 3)).toBe("חצי גמר");
  });
  it("names the quarter-final specially when there are enough rounds", () => {
    expect(knockoutRoundLabel(2, 4)).toBe("רבע גמר");
  });
  it("falls back to a numbered round label for earlier rounds", () => {
    expect(knockoutRoundLabel(1, 4)).toBe("סיבוב 1");
    expect(knockoutRoundLabel(1, 3)).toBe("סיבוב 1");
  });
});

describe("knockoutMatchWinner", () => {
  it("returns 'a' when A scored more frames", () => {
    expect(knockoutMatchWinner(3, 1)).toBe("a");
  });
  it("returns 'b' when B scored more frames", () => {
    expect(knockoutMatchWinner(1, 3)).toBe("b");
  });
  it("returns null when either score is missing", () => {
    expect(knockoutMatchWinner(null, 3)).toBeNull();
    expect(knockoutMatchWinner(3, null)).toBeNull();
    expect(knockoutMatchWinner(null, null)).toBeNull();
  });
  it("returns null for a tie", () => {
    expect(knockoutMatchWinner(2, 2)).toBeNull();
  });
});

describe("computeTournamentPlacement", () => {
  it("returns champion placement for the winner of the final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("זכה/תה בטורניר");
  });

  it("returns runner-up placement for the loser of the final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p3", matches, null)).toBe("מקום 2");
  });

  it("returns semi-final placement for a round-1 loser in a 4-player bracket", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p2", matches, null)).toBe("הודח/ה בחצי הגמר");
  });

  it("returns quarter-final placement for a loser two rounds before a 3-round final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 1, frames_b: 3 },
      { round: 3, participant_a_id: "x", participant_b_id: "y", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("הודח/ה ברבע הגמר");
  });

  it("returns a generic round label for an early exit in a large bracket", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 1, frames_b: 3 },
      { round: 5, participant_a_id: "x", participant_b_id: "y", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("הודח/ה בסיבוב 1");
  });

  it("returns no placement for a player who won their last-played match but hasn't played the next round yet", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 2, participant_a_id: "p1", participant_b_id: null, frames_a: null, frames_b: null },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBeNull();
  });

  it("falls back to house standings when no knockout match has been played", () => {
    const house = {
      memberIds: ["p1", "p2", "p3"],
      matches: [
        { participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
        { participant_a_id: "p1", participant_b_id: "p3", frames_a: 2, frames_b: 3 },
        { participant_a_id: "p2", participant_b_id: "p3", frames_a: 1, frames_b: 3 },
      ],
      label: "בית 1",
    };
    // Standings by wins: p3 (2), p1 (1), p2 (0) — p1 is 2nd place.
    expect(computeTournamentPlacement("p1", [], house)).toBe("מקום 2 בבית 1");
  });

  it("returns null when nothing has been played at all", () => {
    const house = {
      memberIds: ["p1", "p2"],
      matches: [{ participant_a_id: "p1", participant_b_id: "p2", frames_a: null, frames_b: null }],
      label: "בית 1",
    };
    expect(computeTournamentPlacement("p1", [], house)).toBeNull();
  });

  it("returns null when there is no house and no knockout match at all", () => {
    expect(computeTournamentPlacement("p1", [], null)).toBeNull();
  });
});

describe("generateLeagueRounds", () => {
  it("returns nothing for fewer than 2 participants", () => {
    expect(generateLeagueRounds([], 1)).toEqual([]);
    expect(generateLeagueRounds(["p1"], 1)).toEqual([]);
  });

  it("pairs every participant with every other exactly once for a single cycle (even count)", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const fixtures = generateLeagueRounds(ids, 1);
    expect(fixtures).toHaveLength(6); // C(4,2)

    const pairKey = (a: string, b: string) => [a, b].sort().join("-");
    const seen = new Set(fixtures.map((f) => pairKey(f.participantAId, f.participantBId)));
    expect(seen.size).toBe(6); // every pair appears, none repeated

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3])); // n-1 rounds
  });

  it("repeats every pairing exactly numCycles times, with round numbers continuing sequentially", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const fixtures = generateLeagueRounds(ids, 2);
    expect(fixtures).toHaveLength(12); // 6 pairs x 2 cycles

    const pairKey = (a: string, b: string) => [a, b].sort().join("-");
    const counts = new Map<string, number>();
    for (const f of fixtures) {
      const k = pairKey(f.participantAId, f.participantBId);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual(Array(6).fill(2));

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3, 4, 5, 6])); // 2 cycles x 3 rounds, not reset per cycle
  });

  it("handles an odd participant count with a bye — no bye ever appears as a real fixture", () => {
    const ids = ["p1", "p2", "p3"];
    const fixtures = generateLeagueRounds(ids, 1);
    expect(fixtures).toHaveLength(3); // C(3,2)
    for (const f of fixtures) {
      expect(f.participantAId).not.toBeNull();
      expect(f.participantBId).not.toBeNull();
    }
    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3])); // one round per participant when odd
  });

  it("never schedules the same participant twice in the same round", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const fixtures = generateLeagueRounds(ids, 1);
    const byRound = new Map<number, string[]>();
    for (const f of fixtures) {
      const list = byRound.get(f.round) ?? [];
      list.push(f.participantAId, f.participantBId);
      byRound.set(f.round, list);
    }
    for (const [, playersInRound] of byRound) {
      expect(new Set(playersInRound).size).toBe(playersInRound.length);
    }
  });
});
