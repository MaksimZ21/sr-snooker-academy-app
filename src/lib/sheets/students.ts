import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { ensureStudentInCollegeGroup } from "./groups";
import type { Student } from "./schemas";

export type CrmStudent = {
  first_name: string;
  last_name: string;
  phone?: string;
  email: string;
  college_name?: string;
  subscription_type?: string;
};

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
    active: true,
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
    }).eq("id", existing.id);
    revalidateTag("students", { expire: 0 });
    if (input.college_name) {
      await ensureStudentInCollegeGroup(input.college_name, existing.id as string);
    }
    return { id: existing.id as string, action: "updated" as const };
  }

  const id = await appendStudent(input);
  if (input.college_name) {
    await ensureStudentInCollegeGroup(input.college_name, id);
  }
  return { id, action: "created" as const };
}
