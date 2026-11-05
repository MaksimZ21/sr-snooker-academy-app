import { describe, it, expect } from "vitest";
import { normalizePhoneLocal } from "./phone";

describe("normalizePhoneLocal", () => {
  it("brings every way of writing a number to one form", () => {
    for (const raw of ["0501234567", "050-123-4567", "+972 50 123 4567", "972501234567", "+972-050-1234567", "501234567"]) {
      expect(normalizePhoneLocal(raw)).toBe("0501234567");
    }
  });
  it("leaves an empty number empty", () => {
    expect(normalizePhoneLocal("")).toBe("");
    expect(normalizePhoneLocal(" - ")).toBe("");
  });
});
