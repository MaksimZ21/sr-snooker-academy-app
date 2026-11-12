import { describe, it, expect } from "vitest";
import { missingFixtures } from "./tournament-logic";

const m = (a: string, b: string) => ({ participant_a_id: a, participant_b_id: b });

describe("missingFixtures", () => {
  it("a new district: every pair once per cycle", () => {
    expect(missingFixtures(["A", "B", "C"], [], 1)).toEqual([
      ["A", "B"],
      ["A", "C"],
      ["B", "C"],
    ]);
  });

  it("two cycles: each pair twice, home and away swapped", () => {
    expect(missingFixtures(["A", "B"], [], 2)).toEqual([
      ["A", "B"],
      ["B", "A"],
    ]);
  });

  it("a player joining later gets only their own matches", () => {
    const existing = [m("A", "B"), m("A", "C"), m("B", "C")];
    expect(missingFixtures(["A", "B", "C", "D"], existing, 1)).toEqual([
      ["A", "D"],
      ["B", "D"],
      ["C", "D"],
    ]);
  });

  it("nothing missing: nothing added, whichever way a match is listed", () => {
    expect(missingFixtures(["A", "B"], [m("B", "A")], 1)).toEqual([]);
  });
});
