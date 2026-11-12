import { describe, it, expect } from "vitest";
import { levelForTable, skillLevelsFor, SKILL_LEVELS } from "./schemas";

const player = { skill_level: "B+", skill_level_9ft: "A" };

describe("ratings per table size", () => {
  it("a 9-10 ft tournament uses the 9-10 ft rating", () => {
    expect(levelForTable(player, "9-10")).toBe("A");
  });

  it("a 12 ft tournament uses the 12 ft rating", () => {
    expect(levelForTable(player, "12")).toBe("B+");
  });

  it("a tournament with no table set keeps using the 12 ft rating, as before", () => {
    expect(levelForTable(player, null)).toBe("B+");
  });

  it("9-10 ft has plain letters only; 12 ft has the pluses", () => {
    expect(skillLevelsFor("9-10")).toEqual(["A", "B", "C", "D", "E"]);
    expect(skillLevelsFor("12")).toEqual(SKILL_LEVELS);
    expect(skillLevelsFor("12")).toContain("B+");
  });
});
