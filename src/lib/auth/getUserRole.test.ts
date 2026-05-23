import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets/coaches", () => ({
  fetchActiveCoachEmails: vi.fn(),
  readActiveCoachEmails: vi.fn(),
}));

vi.mock("@/lib/sheets/students", () => ({
  fetchActiveStudentEmails: vi.fn(),
}));

import { getUserRole } from "./getUserRole";
import { fetchActiveCoachEmails, readActiveCoachEmails } from "@/lib/sheets/coaches";
import { fetchActiveStudentEmails } from "@/lib/sheets/students";

const mockCoaches = fetchActiveCoachEmails as unknown as ReturnType<typeof vi.fn>;
const mockReadCoaches = readActiveCoachEmails as unknown as ReturnType<typeof vi.fn>;
const mockStudents = fetchActiveStudentEmails as unknown as ReturnType<typeof vi.fn>;

describe("getUserRole", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "boss@academy.com";
    mockCoaches.mockReset();
    mockReadCoaches.mockReset();
    mockStudents.mockReset();
    mockReadCoaches.mockResolvedValue([]);
  });

  it("returns admin without hitting DB when email matches ADMIN_EMAILS", async () => {
    mockCoaches.mockResolvedValue([]);
    mockStudents.mockResolvedValue([]);
    const r = await getUserRole("boss@academy.com");
    expect(r).toBe("admin");
    expect(mockCoaches).not.toHaveBeenCalled();
    expect(mockStudents).not.toHaveBeenCalled();
  });

  it("returns coach when email is in active coaches", async () => {
    mockCoaches.mockResolvedValue(["c@academy.com"]);
    mockStudents.mockResolvedValue([]);
    const r = await getUserRole("c@academy.com");
    expect(r).toBe("coach");
  });

  it("returns student when email is in active students", async () => {
    mockCoaches.mockResolvedValue([]);
    mockStudents.mockResolvedValue(["s@academy.com"]);
    const r = await getUserRole("s@academy.com");
    expect(r).toBe("student");
  });

  it("returns denied otherwise", async () => {
    mockCoaches.mockResolvedValue(["c@academy.com"]);
    mockStudents.mockResolvedValue([]);
    const r = await getUserRole("rando@example.com");
    expect(r).toBe("denied");
  });
});
