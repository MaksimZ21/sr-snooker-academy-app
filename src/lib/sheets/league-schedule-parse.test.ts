import { describe, it, expect } from "vitest";
import {
  parseScheduleDate,
  resolveSchedulePaste,
  buildOpenMatchesText,
  shortDate,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "./league-schedule-parse";

const TODAY = "2026-10-28";

const people: ScheduleParticipant[] = [
  { id: "p1", name: "דני כהן" },
  { id: "p2", name: "יוסי לוי" },
  { id: "p3", name: "משה פרץ" },
  { id: "p4", name: "משה כץ" },
];

function match(id: string, a: string, b: string, extra: Partial<ScheduleMatch> = {}): ScheduleMatch {
  return {
    id,
    district_id: "d1",
    participant_a_id: a,
    participant_b_id: b,
    frames_a: null,
    scheduled_date: null,
    ...extra,
  };
}

describe("parseScheduleDate", () => {
  it("parses D.M and D/M to the nearest year", () => {
    expect(parseScheduleDate("2.11", TODAY)).toBe("2026-11-02");
    expect(parseScheduleDate("2/11", TODAY)).toBe("2026-11-02");
  });

  it("finds the date after a day name", () => {
    expect(parseScheduleDate("יום ראשון 2.11 ", TODAY)).toBe("2026-11-02");
  });

  it("rolls over the year boundary", () => {
    expect(parseScheduleDate("15.1", "2026-12-20")).toBe("2027-01-15");
    expect(parseScheduleDate("30.12", "2027-01-03")).toBe("2026-12-30");
  });

  it("accepts an explicit 2- or 4-digit year", () => {
    expect(parseScheduleDate("2.11.2026", TODAY)).toBe("2026-11-02");
    expect(parseScheduleDate("2.11.26", TODAY)).toBe("2026-11-02");
  });

  it("rejects impossible or missing dates", () => {
    expect(parseScheduleDate("31.2", TODAY)).toBeNull();
    expect(parseScheduleDate("יום ראשון", TODAY)).toBeNull();
  });
});

describe("shortDate", () => {
  it("formats an ISO date as D.M", () => {
    expect(shortDate("2026-11-02")).toBe("2.11");
  });
});

describe("resolveSchedulePaste", () => {
  it("matches a line to the open match between the two players", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res).toEqual([
      { raw: "2.11 | דני כהן - יוסי לוי", ok: true, matchId: "m1", date: "2026-11-02", districtId: "d1", movedFrom: null },
    ]);
  });

  it("accepts either player order and נגד as the separator", () => {
    const res = resolveSchedulePaste("2.11 | יוסי לוי נגד דני כהן", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: true, matchId: "m1" });
  });

  it("ignores blank lines and lines without |", () => {
    const res = resolveSchedulePaste("לוז לשבוע:\n\n2.11 | דני כהן - יוסי לוי\n", people, [match("m1", "p1", "p2")], TODAY);
    expect(res).toHaveLength(1);
  });

  it("accepts a first name that matches exactly one player", () => {
    const res = resolveSchedulePaste("2.11 | דני - יוסי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: true, matchId: "m1" });
  });

  it("rejects an ambiguous first name", () => {
    const res = resolveSchedulePaste("2.11 | משה - דני כהן", people, [match("m1", "p3", "p1")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: expect.stringContaining("לא חד-משמעי") });
  });

  it("rejects an unknown name", () => {
    const res = resolveSchedulePaste("2.11 | אבי - דני כהן", people, [match("m1", "p3", "p1")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: expect.stringContaining("לא נמצא") });
  });

  it("rejects the same player on both sides", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - דני כהן", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: false });
  });

  it("rejects a pair with no open match", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2", { frames_a: 2 })], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: "אין משחק פתוח ביניהם" });
  });

  it("rejects the same match twice in one paste", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי\n3.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2")],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true });
    expect(res[1]).toMatchObject({ ok: false, error: "המשחק כבר מופיע בשורה קודמת" });
  });

  it("prefers an unscheduled match when the pair has several open ones", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2", { scheduled_date: "2026-10-27" }), match("m2", "p1", "p2")],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true, matchId: "m2", movedFrom: null });
  });

  it("moves the earliest-scheduled match when every open one is scheduled", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2", { scheduled_date: "2026-10-27" }), match("m2", "p1", "p2", { scheduled_date: "2026-10-20" })],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true, matchId: "m2", movedFrom: "2026-10-20" });
  });

  it("reports a bad date", () => {
    const res = resolveSchedulePaste("31.2 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: "תאריך לא תקין" });
  });
});

describe("buildOpenMatchesText", () => {
  it("lists only unplayed matches per district, noting scheduled ones", () => {
    const text = buildOpenMatchesText(
      "ליגת חורף",
      [
        {
          label: "צפון",
          matches: [
            match("m1", "p1", "p2"),
            match("m2", "p1", "p3", { frames_a: 2 }),
            match("m3", "p2", "p3", { scheduled_date: "2026-11-02" }),
          ],
        },
      ],
      people,
    );
    expect(text).toContain("ליגת חורף");
    expect(text).toContain("צפון:");
    expect(text).toContain("דני כהן - יוסי לוי");
    expect(text).not.toContain("דני כהן - משה פרץ");
    expect(text).toContain("יוסי לוי - משה פרץ (משובץ ל-2.11)");
  });
});
