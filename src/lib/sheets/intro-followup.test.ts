import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ db: {} }));

import { followupEventDate } from "./intro-followup";
import { introFollowupTemplate } from "@/lib/whatsapp/meta-cloud";

describe("followupEventDate", () => {
  it("nothing is due before noon in Israel", () => {
    // 11:59 Israel (UTC+2 in November)
    expect(followupEventDate(new Date("2026-11-12T09:59:00Z"))).toBeNull();
  });

  it("from noon, yesterday's event is due", () => {
    expect(followupEventDate(new Date("2026-11-12T10:00:00Z"))).toBe("2026-11-11");
    expect(followupEventDate(new Date("2026-11-12T21:30:00Z"))).toBe("2026-11-11");
  });

  it("uses the Israeli date, not UTC, late at night", () => {
    // 00:30 on the 13th in Israel is still 22:30 on the 12th in UTC -> before noon, none due
    expect(followupEventDate(new Date("2026-11-12T22:30:00Z"))).toBeNull();
  });

  it("crosses month boundaries", () => {
    expect(followupEventDate(new Date("2026-12-01T12:00:00Z"))).toBe("2026-11-30");
  });
});

describe("introFollowupTemplate", () => {
  it("fills the named customer_name variable in Hebrew", () => {
    expect(introFollowupTemplate(" דני ")).toEqual({
      name: "academy_event_followup",
      language: { code: "he" },
      components: [
        { type: "body", parameters: [{ type: "text", parameter_name: "customer_name", text: "דני" }] },
      ],
    });
  });

  it("never sends an empty name (Meta rejects it)", () => {
    expect(introFollowupTemplate("").components[0].parameters[0].text).toBe("שחקן יקר");
  });
});
