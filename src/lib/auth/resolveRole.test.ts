import { describe, it, expect } from "vitest";
import { resolveRole } from "./resolveRole";

describe("resolveRole", () => {
  it("returns admin when email is in ADMIN_EMAILS", () => {
    const r = resolveRole({
      email: "owner@academy.com",
      adminEmails: "owner@academy.com,boss@academy.com",
      activeCoachEmails: [],
    });
    expect(r).toBe("admin");
  });

  it("returns coach when email is in active coach list", () => {
    const r = resolveRole({
      email: "coach1@academy.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("coach");
  });

  it("returns denied when email is not in either list", () => {
    const r = resolveRole({
      email: "rando@example.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("denied");
  });

  it("admin wins over coach (same email in both lists)", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: "boss@academy.com",
      activeCoachEmails: ["boss@academy.com"],
    });
    expect(r).toBe("admin");
  });

  it("is case-insensitive on email", () => {
    const r = resolveRole({
      email: "Coach1@Academy.com",
      adminEmails: "",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("coach");
  });

  it("trims whitespace in ADMIN_EMAILS csv", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: " boss@academy.com , owner@academy.com ",
      activeCoachEmails: [],
    });
    expect(r).toBe("admin");
  });
});
