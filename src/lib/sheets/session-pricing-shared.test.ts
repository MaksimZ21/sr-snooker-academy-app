import { describe, it, expect } from "vitest";
import { resolveSessionPricing, type SessionPricingRule } from "./session-pricing-shared";

const rules: SessionPricingRule[] = [
  { id: "1", label: "מכללה", price_nis: 150 },
  { id: "2", label: "אירוע הכרות", price_nis: 150 },
];

describe("resolveSessionPricing", () => {
  it("matches a rule whose label appears in the session name", () => {
    expect(resolveSessionPricing("מכללת תל אביב", rules)).toEqual({ source: "מכללה", price_nis: 150 });
  });

  it("matches case-insensitively", () => {
    const en: SessionPricingRule[] = [{ id: "1", label: "College", price_nis: 150 }];
    expect(resolveSessionPricing("COLLEGE session", en)).toEqual({ source: "College", price_nis: 150 });
  });

  it("returns null when no rule matches", () => {
    expect(resolveSessionPricing("שיעור פרטי", rules)).toBeNull();
  });

  it("returns the first matching rule when multiple could match", () => {
    expect(resolveSessionPricing("מכללה - אירוע הכרות", rules)).toEqual({ source: "מכללה", price_nis: 150 });
  });

  it("returns null for an empty name", () => {
    expect(resolveSessionPricing("", rules)).toBeNull();
  });

  it("matches the Hebrew construct-state variant (מכללה -> מכללת X)", () => {
    expect(resolveSessionPricing("מכללת חיפה", rules)).toEqual({ source: "מכללה", price_nis: 150 });
  });
});
