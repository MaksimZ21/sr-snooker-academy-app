import { revalidateTag } from "next/cache";
import { resolveRole, type Role } from "./resolveRole";
import { fetchActiveCoachEmails, readActiveCoachEmails } from "@/lib/sheets/coaches";

export async function getUserRole(email: string): Promise<Role> {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const fastAdmin = resolveRole({ email, adminEmails, activeCoachEmails: [] });
  if (fastAdmin === "admin") return "admin";
  const cached = await fetchActiveCoachEmails();
  const cachedRole = resolveRole({ email, adminEmails, activeCoachEmails: cached });
  if (cachedRole !== "denied") return cachedRole;
  // Cache says denied — could be stale (admin just added them in the Sheet).
  // Do one uncached lookup before truly denying.
  const fresh = await readActiveCoachEmails();
  const freshRole = resolveRole({ email, adminEmails, activeCoachEmails: fresh });
  if (freshRole !== "denied") {
    revalidateTag("coaches", { expire: 0 });
  }
  return freshRole;
}
