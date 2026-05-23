import { revalidateTag } from "next/cache";
import { resolveRole, type Role } from "./resolveRole";
import { fetchActiveCoachEmails, readActiveCoachEmails } from "@/lib/sheets/coaches";
import { fetchActiveStudentEmails } from "@/lib/sheets/students";

export async function getUserRole(email: string): Promise<Role> {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const fastAdmin = resolveRole({ email, adminEmails, activeCoachEmails: [], activeStudentEmails: [] });
  if (fastAdmin === "admin") return "admin";

  const [cachedCoaches, cachedStudents] = await Promise.all([
    fetchActiveCoachEmails(),
    fetchActiveStudentEmails(),
  ]);
  const cachedRole = resolveRole({ email, adminEmails, activeCoachEmails: cachedCoaches, activeStudentEmails: cachedStudents });
  if (cachedRole !== "denied") return cachedRole;

  // Cache says denied — could be stale. Do one uncached coach lookup before truly denying.
  const fresh = await readActiveCoachEmails();
  const freshRole = resolveRole({ email, adminEmails, activeCoachEmails: fresh, activeStudentEmails: cachedStudents });
  if (freshRole !== "denied") {
    revalidateTag("coaches", { expire: 0 });
  }
  return freshRole;
}
