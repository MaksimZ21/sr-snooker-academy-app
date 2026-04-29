import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/google/sheets", () => ({
  getSheetsClient: () => ({
    spreadsheets: {
      values: {
        get: vi.fn().mockResolvedValue({
          data: {
            values: [
              ["email", "name", "phone", "active"],
              ["c1@a.com", "Coach 1", "050", "TRUE"],
              ["c2@a.com", "Coach 2", "", "FALSE"],
              ["c3@a.com", "Coach 3", "051", "TRUE"],
            ],
          },
        }),
      },
    },
  }),
  getSheetId: () => "test-sheet",
}));

import { fetchActiveCoachEmails, parseCoachesSheet } from "./coaches";

describe("parseCoachesSheet", () => {
  it("filters to only active coaches and returns lowercased emails", () => {
    const rows = [
      ["email", "name", "phone", "active"],
      ["C1@A.com", "x", "", "TRUE"],
      ["c2@a.com", "y", "", "false"],
      ["c3@a.com", "z", "", "TRUE"],
    ];
    expect(parseCoachesSheet(rows)).toEqual(["c1@a.com", "c3@a.com"]);
  });

  it("returns empty when only header is present", () => {
    expect(parseCoachesSheet([["email", "name", "phone", "active"]])).toEqual([]);
  });
});

describe("fetchActiveCoachEmails", () => {
  it("returns active emails from the sheet", async () => {
    const r = await fetchActiveCoachEmails();
    expect(r).toEqual(["c1@a.com", "c3@a.com"]);
  });
});
