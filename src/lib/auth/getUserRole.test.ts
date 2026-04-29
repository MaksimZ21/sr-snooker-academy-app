import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets/coaches", () => ({
  fetchActiveCoachEmails: vi.fn(),
}));

import { getUserRole } from "./getUserRole";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

const mockFetch = fetchActiveCoachEmails as unknown as ReturnType<typeof vi.fn>;

describe("getUserRole", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "boss@academy.com";
    mockFetch.mockReset();
  });

  it("returns admin without hitting Sheets when email matches ADMIN_EMAILS", async () => {
    mockFetch.mockResolvedValue([]);
    const r = await getUserRole("boss@academy.com");
    expect(r).toBe("admin");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns coach when email is in Coaches sheet", async () => {
    mockFetch.mockResolvedValue(["c@academy.com"]);
    const r = await getUserRole("c@academy.com");
    expect(r).toBe("coach");
  });

  it("returns denied otherwise", async () => {
    mockFetch.mockResolvedValue(["c@academy.com"]);
    const r = await getUserRole("rando@example.com");
    expect(r).toBe("denied");
  });
});
