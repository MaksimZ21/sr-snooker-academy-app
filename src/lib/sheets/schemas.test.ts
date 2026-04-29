import { describe, it, expect } from "vitest";
import {
  StudentRow,
  SessionRow,
  AttendanceRow,
  NoteRow,
  GuidelineRow,
  PricingRow,
  parseRows,
} from "./schemas";

describe("parseRows + Student", () => {
  it("parses Students rows by header", () => {
    const rows = [
      ["id", "name", "phone", "parent_name", "parent_phone", "general_notes", "active"],
      ["S1", "Eli", "050", "Dan", "051", "", "TRUE"],
    ];
    const r = parseRows(rows, StudentRow);
    expect(r).toEqual([
      {
        id: "S1",
        name: "Eli",
        phone: "050",
        parent_name: "Dan",
        parent_phone: "051",
        general_notes: "",
        active: true,
      },
    ]);
  });
});

describe("Session csv student_ids", () => {
  it("splits comma-separated student_ids", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status"],
      ["SES1","2026-04-29","17:00","18:00","c@a.com","private","S1, S2,S3","","scheduled"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].student_ids).toEqual(["S1", "S2", "S3"]);
  });
});

describe("Attendance/Note/Guideline/Pricing", () => {
  it("compiles", () => {
    expect(AttendanceRow).toBeDefined();
    expect(NoteRow).toBeDefined();
    expect(GuidelineRow).toBeDefined();
    expect(PricingRow).toBeDefined();
  });
});
