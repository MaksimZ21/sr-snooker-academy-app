import { describe, it, expect } from "vitest";
import { formatHebrewDate, weekRangeFor, todayIsoTel } from "./date";

describe("formatHebrewDate", () => {
  it("formats a Gregorian date in Hebrew", () => {
    const r = formatHebrewDate("2026-04-29");
    expect(r).toContain("אפריל");
    expect(r).toContain("2026");
  });
});

describe("weekRangeFor", () => {
  it("returns Sunday..Saturday for a Wednesday", () => {
    const { startIso, endIso } = weekRangeFor("2026-04-29"); // Wed
    expect(startIso).toBe("2026-04-26"); // Sun
    expect(endIso).toBe("2026-05-02");   // Sat
  });
  it("when given Sunday, returns same Sunday", () => {
    const { startIso, endIso } = weekRangeFor("2026-04-26");
    expect(startIso).toBe("2026-04-26");
    expect(endIso).toBe("2026-05-02");
  });
});

describe("todayIsoTel", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayIsoTel()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
