import { normalizePhoneLocal } from "@/lib/phone";
import type { Assessment } from "./assessment-types";

type StudentIdentity = { first_name: string; last_name: string; phone: string | null | undefined };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// An assessment is written at an intro event, usually before the player has
// a student record, so it only carries the name and phone typed there. It
// belongs to a student when BOTH match: the phone (in any format) and the
// exact full name. The name is what keeps siblings registered under a
// parent's phone from seeing each other's report.
export function assessmentMatchesStudent(
  a: Pick<Assessment, "participant_name" | "participant_phone">,
  s: StudentIdentity,
): boolean {
  const phoneA = normalizePhoneLocal(a.participant_phone ?? "");
  const phoneS = normalizePhoneLocal(s.phone ?? "");
  if (!phoneA || phoneA !== phoneS) return false;
  const fullName = normalizeName([s.first_name, s.last_name].filter(Boolean).join(" "));
  return fullName !== "" && normalizeName(a.participant_name) === fullName;
}
