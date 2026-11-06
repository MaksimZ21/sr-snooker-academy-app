import { describe, it, expect, vi } from "vitest";

const role = vi.hoisted(() => ({ current: "student" }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "x@y.com" } } }) },
  }),
}));
vi.mock("./getUserRole", () => ({ getUserRole: async () => role.current }));

import { requireStaff } from "./requireUser";

describe("requireStaff", () => {
  it("turns a logged-in student away", async () => {
    role.current = "student";
    const thrown = await requireStaff().catch((e) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("lets coaches and admins through", async () => {
    for (const r of ["coach", "admin"]) {
      role.current = r;
      await expect(requireStaff()).resolves.toMatchObject({ role: r });
    }
  });
});
