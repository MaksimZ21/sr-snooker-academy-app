import { describe, it, expect, vi } from "vitest";

const filters = vi.hoisted(() => [] as [string, unknown][]);
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/db/client", () => {
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    order: async () => ({ data: [] }),
  };
  return { db: { from: () => query } };
});

import { fetchStudentVisibleNotes } from "./notes";

describe("fetchStudentVisibleNotes", () => {
  it("asks the database only for notes the student may see", async () => {
    await fetchStudentVisibleNotes("S1");
    expect(filters).toContainEqual(["student_id", "S1"]);
    expect(filters).toContainEqual(["visibility", "student"]);
  });
});
