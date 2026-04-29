import { resolveRole, type Role } from "./resolveRole";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function getUserRole(email: string): Promise<Role> {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const fastAdmin = resolveRole({ email, adminEmails, activeCoachEmails: [] });
  if (fastAdmin === "admin") return "admin";
  const activeCoachEmails = await fetchActiveCoachEmails();
  return resolveRole({ email, adminEmails, activeCoachEmails });
}
