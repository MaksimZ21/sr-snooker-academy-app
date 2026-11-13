import { describe, it, expect } from "vitest";
import { levelChangePoints, levelStatus, nextLevel } from "./league-level-logic";

// 12 ft scale: A, B+, B, C+, C, D, E
describe("levelChangePoints", () => {
  it("same level: +0.25 / -0.25", () => {
    expect(levelChangePoints("C", "C", "win")).toBe(0.25);
    expect(levelChangePoints("C", "C", "loss")).toBe(-0.25);
  });

  it("beating a weaker player: +0.5; losing to a stronger one: -0.5", () => {
    expect(levelChangePoints("A", "E", "win")).toBe(0.5);
    expect(levelChangePoints("E", "A", "loss")).toBe(-0.5);
  });

  it("beating a stronger player by gap", () => {
    expect(levelChangePoints("B", "B+", "win")).toBe(1); // 1
    expect(levelChangePoints("C+", "B+", "win")).toBe(1); // 2
    expect(levelChangePoints("C", "B+", "win")).toBe(2); // 3
    expect(levelChangePoints("D", "B+", "win")).toBe(3); // 4
    expect(levelChangePoints("E", "A", "win")).toBe(3); // 6
  });

  it("losing to a weaker player by gap", () => {
    expect(levelChangePoints("B+", "B", "loss")).toBe(-1);
    expect(levelChangePoints("B+", "C", "loss")).toBe(-2);
    expect(levelChangePoints("A", "D", "loss")).toBe(-3);
  });

  it("a draw changes nothing", () => {
    expect(levelChangePoints("A", "E", "draw")).toBe(0);
  });

  it("a player with no level isn't counted", () => {
    expect(levelChangePoints(null, "B", "win")).toBeNull();
    expect(levelChangePoints("B", null, "loss")).toBeNull();
  });
});

describe("levelStatus", () => {
  it("needs at least 4 matches", () => {
    expect(levelStatus("C", 6, 3)).toBeNull();
    expect(levelStatus("C", 6, 4)).toBe("up");
  });

  it("+5 = candidate up, -5 = candidate down", () => {
    expect(levelStatus("C", 5, 5)).toBe("up");
    expect(levelStatus("C", -5, 5)).toBe("down");
    expect(levelStatus("C", 4.75, 9)).toBeNull();
  });

  it("A can't go up and E can't go down", () => {
    expect(levelStatus("A", 8, 6)).toBeNull();
    expect(levelStatus("E", -8, 6)).toBeNull();
  });
});

describe("nextLevel", () => {
  it("moves one level at a time", () => {
    expect(nextLevel("C", "up")).toBe("C+");
    expect(nextLevel("C+", "down")).toBe("C");
    expect(nextLevel("A", "up")).toBeNull();
  });
});

describe("with a custom level list from the settings page", () => {
  const levels = ["A", "B+", "B", "C+", "C", "D", "E", "F", "G+", "G", "H", "I"];
  it("counts gaps using the custom list", () => {
    // I beats A: 11 levels apart.
    expect(levelChangePoints("I", "A", "win", levels)).toBe(4);
    expect(levelChangePoints("F", "E", "win", levels)).toBe(1);
  });
  it("lets E go down to F, and stops at the last level", () => {
    expect(nextLevel("E", "down", levels)).toBe("F");
    expect(levelStatus("I", -6, 5, levels)).toBeNull();
    expect(levelStatus("E", -6, 5, levels)).toBe("down");
  });
  it("ignores a level that isn't in the list", () => {
    expect(levelChangePoints("Z", "A", "win", levels)).toBeNull();
  });
});
