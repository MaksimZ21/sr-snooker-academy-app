import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup, toConstructForm } from "./groups";
import type { Student } from "./schemas";
import { normalizePhoneLocal } from "@/lib/phone";
import { isSameFullName } from "@/lib/student-name";

export type CrmStudent = {
  first_name: string;
  last_name: string;
  phone?: string;
  email: string;
  college_name?: string;
  college_group?: string;
  subscription_type?: string;
  birth_date?: string | null;
};

// Resolves group placement from a CRM payload. `college_group` (a specific
// cohort/time-slot name, e.g. "מכללת כפ\"ס קבוצה 1 - ימי רביעי 19:30")
// is tried first — it only ever joins an EXISTING matching group, never
// creates one. When it doesn't match (the exact cohort isn't saved as its
// own group, or its college abbreviation doesn't match the full name),
// fall back to the broader college_name find-or-create flow instead of
// leaving the student unassigned (updated 2026-10-15 — the no-fallback
// behavior from 2026-08-29 meant every such case needed a manual fix).
async function assignGroupFromCrm(input: CrmStudent, studentId: string): Promise<boolean> {
  if (input.college_group) {
    const matched = await assignStudentToExistingGroup(input.college_group, studentId);
    if (matched) return true;
  }
  if (input.college_name) {
    await ensureStudentInCollegeGroup(input.college_name, studentId);
    return true;
  }
  return false;
}

export const fetchStudents = unstable_cache(
  async (): Promise<Student[]> => {
    const { data } = await db.from("students").select("*").order("last_name").order("first_name");
    return (data ?? []) as Student[];
  },
  ["students:all"],
  { revalidate: 300, tags: ["students"] },
);

// The one lookup every entry point uses: a phone number identifies a player.
// limit(1) rather than maybeSingle(), which reports "nothing found" when two
// rows match — that used to create yet another copy.
export async function findStudentIdByPhone(phone: string): Promise<string | null> {
  const local = normalizePhoneLocal(phone);
  if (!local) return null;
  const { data } = await db
    .from("students")
    .select("id")
    .or(`phone.eq.${local},phone.eq.972${local.slice(1)}`)
    .order("is_tournament_only")
    .order("id")
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

// A player typed in by hand (a name, no phone) who then arrives with a phone
// number is the same player. Only a full name that matches exactly one such
// row counts; a lone first name is too weak to go on.
async function findPhonelessStudentIdByName(firstName: string, lastName: string): Promise<string | null> {
  const fullName = `${firstName} ${lastName}`.trim();
  if (!fullName.includes(" ")) return null;
  const { data } = await db.from("students").select("id, first_name, last_name").eq("phone", "");
  const matches = (data ?? []).filter((s) => isSameFullName(`${s.first_name} ${s.last_name}`, fullName));
  return matches.length === 1 ? (matches[0].id as string) : null;
}

// Find-or-create: with a phone number that already belongs to someone, this
// returns that player rather than adding a copy.
export async function appendStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
  last_payment_date?: string | null;
  active?: boolean;
  is_tournament_only?: boolean;
  rating?: number;
  public_slug?: string | null;
  skill_level?: string | null;
  skill_level_9ft?: string | null;
}) {
  const phone = normalizePhoneLocal(input.phone ?? "");
  if (phone) {
    const existingId = await findStudentIdByPhone(phone);
    if (existingId) return existingId;
    const phonelessId = await findPhonelessStudentIdByName(input.first_name ?? "", input.last_name ?? "");
    if (phonelessId) {
      await db.from("students").update({ phone }).eq("id", phonelessId);
      revalidateTag("students", { expire: 0 });
      return phonelessId;
    }
  }

  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  const { error } = await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone,
    email: input.email ?? "",
    college_name: toConstructForm(input.college_name ?? ""),
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    last_payment_date: input.last_payment_date ?? null,
    active: input.active ?? true,
    is_tournament_only: input.is_tournament_only ?? false,
    rating: input.rating ?? 1000,
    public_slug: input.public_slug ?? null,
    skill_level: input.skill_level ?? null,
    skill_level_9ft: input.skill_level_9ft ?? null,
  });
  if (error) {
    // Two deliveries of the same registration at once: the other one won.
    const winnerId = error.code === "23505" && phone ? await findStudentIdByPhone(phone) : null;
    if (winnerId) return winnerId;
    throw new Error(error.message);
  }
  revalidateTag("students", { expire: 0 });
  return id;
}

// The admin's "add student" form. A number that belongs to someone who has
// only played tournaments/leagues makes them a real student, keeping their
// history. A number that belongs to an existing student is a mistake to show.
export async function createOrPromoteStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
  last_payment_date?: string | null;
  skill_level?: string | null;
  skill_level_9ft?: string | null;
}): Promise<string> {
  const existingId = input.phone ? await findStudentIdByPhone(input.phone) : null;
  if (!existingId) return appendStudent(input);

  const { data: existing } = await db
    .from("students")
    .select("first_name, last_name, is_tournament_only")
    .eq("id", existingId)
    .maybeSingle();
  if (!existing?.is_tournament_only) {
    const name = [existing?.first_name, existing?.last_name].filter(Boolean).join(" ");
    throw new Error(`כבר קיים מתאמן עם מספר הטלפון הזה: ${name}`);
  }
  await updateStudent(existingId, { ...input, active: true, is_tournament_only: false });
  return existingId;
}

// Deliberately not filtered by `active` — a student who stopped coming (or
// a tournament-only customer, who is always `active: false` by design) can
// still be sent a login invite and must still resolve to the "student"
// role. `active` is a scheduling/roster concept (who shows up in group and
// session pickers), not a login gate — see docs/superpowers/specs/2026-08-11-
// tournaments-design.md, "Personal Player Area".
export const fetchStudentEmails = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await db.from("students").select("email");
    return (data ?? []).map((r) => (r.email as string).toLowerCase()).filter(Boolean);
  },
  ["students:emails"],
  { revalidate: 300, tags: ["students"] },
);

export async function getStudentByEmail(email: string): Promise<Student | null> {
  const { data } = await db
    .from("students")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data as Student) ?? null;
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await db.from("students").delete().eq("id", id);
  if (error) {
    // 23503 = foreign key violation — some other table still has a row
    // referencing this student that Postgres refuses to orphan (tournament
    // and league participation are deliberately exempt — see migration
    // 20261009 — so this is most likely attendance or a group roster).
    // Without this check the delete call silently no-ops: the API still
    // returns success and the row stays exactly where it was.
    if (error.code === "23503") {
      throw new Error("לא ניתן למחוק מתאמן — הוא עדיין משויך לרשומות אחרות במערכת (למשל נוכחות באימון)");
    }
    throw new Error(error.message);
  }
  revalidateTag("students", { expire: 0 });
}

export async function updateStudent(
  id: string,
  input: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    college_name?: string;
    subscription_type?: string;
    general_notes?: string;
    birth_date?: string | null;
    last_payment_date?: string | null;
    active?: boolean;
    is_tournament_only?: boolean;
    rating?: number;
    skill_level?: string | null;
    skill_level_9ft?: string | null;
  },
): Promise<void> {
  const row = {
    ...input,
    ...(input.college_name !== undefined && { college_name: toConstructForm(input.college_name) }),
    ...(input.phone !== undefined && { phone: normalizePhoneLocal(input.phone) }),
  };
  const { error } = await db.from("students").update(row).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("מספר הטלפון הזה כבר שייך לשחקן אחר");
    throw new Error(error.message);
  }
  revalidateTag("students", { expire: 0 });
}

export async function upsertStudentFromCrm(input: CrmStudent) {
  // match by email first, then by phone
  let existingId: string | null = null;
  if (input.email) {
    const { data } = await db.from("students").select("id").eq("email", input.email).limit(1);
    existingId = (data?.[0]?.id as string) ?? null;
  }
  const phoneOwnerId = input.phone ? await findStudentIdByPhone(input.phone) : null;
  existingId ??= phoneOwnerId;

  if (existingId) {
    const { data: current } = await db
      .from("students")
      .select("is_tournament_only")
      .eq("id", existingId)
      .maybeSingle();
    await db.from("students").update({
      first_name: input.first_name,
      last_name: input.last_name,
      // Never take over a number that belongs to a different player.
      ...((!phoneOwnerId || phoneOwnerId === existingId) && { phone: normalizePhoneLocal(input.phone ?? "") }),
      college_name: toConstructForm(input.college_name ?? ""),
      subscription_type: input.subscription_type ?? "",
      ...(input.birth_date !== undefined && { birth_date: input.birth_date }),
      // Someone who only played tournaments until now just became a student.
      ...(current?.is_tournament_only && { is_tournament_only: false, active: true }),
    }).eq("id", existingId);
    revalidateTag("students", { expire: 0 });
    const group_assigned = await assignGroupFromCrm(input, existingId);
    return { id: existingId, action: "updated" as const, group_assigned };
  }

  const id = await appendStudent(input);
  const group_assigned = await assignGroupFromCrm(input, id);
  return { id, action: "created" as const, group_assigned };
}
