import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Student } from "./schemas";

export const fetchStudents = unstable_cache(
  async (): Promise<Student[]> => {
    const { data } = await db.from("students").select("*").order("name");
    return (data ?? []) as Student[];
  },
  ["students:all"],
  { revalidate: 300, tags: ["students"] },
);

export async function appendStudent(input: {
  name: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  general_notes?: string;
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    name: input.name,
    phone: input.phone ?? "",
    parent_name: input.parent_name ?? "",
    parent_phone: input.parent_phone ?? "",
    general_notes: input.general_notes ?? "",
    active: true,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
