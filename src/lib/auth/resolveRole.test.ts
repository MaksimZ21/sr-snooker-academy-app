import { describe, it, expect } from "vitest";
import { resolveRole } from "./resolveRole";

describe("resolveRole", () => {
  it("returns admin when email is in ADMIN_EMAILS", () => {
    const r = resolveRole({
      email: "owner@academy.com",
      adminEmails: "owner@academy.com,boss@academy.com",
      activeCoachEmails: [],
      activeStudentEmails: [],
    });
    expect(r).toBe("admin");
  });

  it("returns coach when email is in active coach list", () => {
    const r = resolveRole({
      email: "coach1@academy.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
      activeStudentEmails: [],
    });
    expect(r).toBe("coach");
  });

  it("returns denied when email is not in either list", () => {
    const r = resolveRole({
      email: "rando@example.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
      activeStudentEmails: [],
    });
    expect(r).toBe("denied");
  });

  it("admin wins over coach (same email in both lists)", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: "boss@academy.com",
      activeCoachEmails: ["boss@academy.com"],
      activeStudentEmails: [],
    });
    expect(r).toBe("admin");
  });

  it("is case-insensitive on email", () => {
    const r = resolveRole({
      email: "Coach1@Academy.com",
      adminEmails: "",
      activeCoachEmails: ["coach1@academy.com"],
      activeStudentEmails: [],
    });
    expect(r).toBe("coach");
  });

  it("trims whitespace in ADMIN_EMAILS csv", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: " boss@academy.com , owner@academy.com ",
      activeCoachEmails: [],
      activeStudentEmails: [],
    });
    expect(r).toBe("admin");
  });

  it("returns student for active student email", () => {
    const r = resolveRole({
      email: "student@a.com",
      adminEmails: "",
      activeCoachEmails: [],
      activeStudentEmails: ["student@a.com"],
    });
    expect(r).toBe("student");
  });

  it("admin takes precedence over student", () => {
    const r = resolveRole({
      email: "admin@a.com",
      adminEmails: "admin@a.com",
      activeCoachEmails: [],
      activeStudentEmails: ["admin@a.com"],
    });
    expect(r).toBe("admin");
  });

  it("coach takes precedence over student", () => {
    const r = resolveRole({
      email: "coach@a.com",
      adminEmails: "",
      activeCoachEmails: ["coach@a.com"],
      activeStudentEmails: ["coach@a.com"],
    });
    expect(r).toBe("coach");
  });
});
