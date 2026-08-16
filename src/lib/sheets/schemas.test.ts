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
      ["id", "first_name", "last_name", "phone", "email", "college_name", "subscription_type", "general_notes", "active"],
      ["S1", "Eli", "Cohen", "050", "eli@test.com", "TAU", "monthly", "", "TRUE"],
    ];
    const r = parseRows(rows, StudentRow);
    expect(r).toEqual([
      {
        id: "S1",
        first_name: "Eli",
        last_name: "Cohen",
        phone: "050",
        email: "eli@test.com",
        college_name: "TAU",
        subscription_type: "monthly",
        general_notes: "",
        birth_date: null,
        last_payment_date: null,
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

describe("SessionRow crm_appointment_id", () => {
  it("defaults crm_appointment_id to empty string when missing", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status"],
      ["SES1","2026-05-27","17:00","","c@a.com","group","S1","","scheduled"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].crm_appointment_id).toBe("");
  });

  it("parses crm_appointment_id when present", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status","crm_appointment_id"],
      ["SES1","2026-05-27","17:00","","c@a.com","group","S1","","scheduled","678892"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].crm_appointment_id).toBe("678892");
  });
});

describe("AttendanceRow confirmed status", () => {
  it("accepts confirmed as a valid status", () => {
    const result = AttendanceRow.safeParse({
      session_id: "SES1",
      student_id: "S1",
      status: "confirmed",
      marked_by: "crm",
      marked_at: "2026-05-27T17:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("confirmed");
  });
});
