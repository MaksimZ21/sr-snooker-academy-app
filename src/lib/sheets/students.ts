import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { ensureStudentInCollegeGroup, assignStudentToExistingGroup } from "./groups";
import type { Student } from "./schemas";

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
// cohort/time-slot name) takes priority when present — it only ever joins
// an EXISTING matching group, never creates one, and does NOT fall back to
// the college_name flow if no match is found (per explicit product
// decision, 2026-08-28): an admin handles that case manually rather than
// the student silently landing in the wrong (college-wide) group. Only
// when `college_group` is absent does the older college_name find-or-create
// behavior apply, unchanged.
async function assignGroupFromCrm(input: CrmStudent, studentId: string): Promise<boolean> {
  if (input.college_group) {
    return assignStudentToExistingGroup(input.college_group, studentId);
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
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    college_name: input.college_name ?? "",
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    last_payment_date: input.last_payment_date ?? null,
    active: input.active ?? true,
    is_tournament_only: input.is_tournament_only ?? false,
    rating: input.rating ?? 1000,
    public_slug: input.public_slug ?? null,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}

export const fetchActiveStudentEmails = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await db.from("students").select("email").eq("active", true);
    return (data ?? []).map((r) => (r.email as string).toLowerCase()).filter(Boolean);
  },
  ["students:active-emails"],
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
  await db.from("students").delete().eq("id", id);
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
  },
): Promise<void> {
  await db.from("students").update(input).eq("id", id);
  revalidateTag("students", { expire: 0 });
}

export async function upsertStudentFromCrm(input: CrmStudent) {
  // match by email first, then by phone
  let existing: { id: string } | null = null;

  if (input.email) {
    const { data } = await db.from("students").select("id").eq("email", input.email).maybeSingle();
    existing = data as { id: string } | null;
  }

  if (!existing && input.phone) {
    const { data } = await db.from("students").select("id").eq("phone", input.phone).maybeSingle();
    existing = data as { id: string } | null;
  }

  if (existing) {
    await db.from("students").update({
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone ?? "",
      college_name: input.college_name ?? "",
      subscription_type: input.subscription_type ?? "",
      ...(input.birth_date !== undefined && { birth_date: input.birth_date }),
    }).eq("id", existing.id);
    revalidateTag("students", { expire: 0 });
    const group_assigned = await assignGroupFromCrm(input, existing.id as string);
    return { id: existing.id as string, action: "updated" as const, group_assigned };
  }

  const id = await appendStudent(input);
  const group_assigned = await assignGroupFromCrm(input, id);
  return { id, action: "created" as const, group_assigned };
}
