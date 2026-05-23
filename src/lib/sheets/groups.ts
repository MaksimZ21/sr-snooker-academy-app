import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Group } from "./schemas";

async function readAll(): Promise<Group[]> {
  const { data } = await db.from("groups").select("*").order("name");
  return (data ?? []) as Group[];
}

export const fetchGroupsAll = unstable_cache(readAll, ["groups:all"], {
  revalidate: 60,
  tags: ["groups"],
});

export function invalidateGroups() {
  revalidateTag("groups", { expire: 0 });
}

export async function appendGroup(name: string, studentIds: string[]) {
  const { data } = await db.from("groups").select("id");
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^GRP-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `GRP-${String(next).padStart(3, "0")}`;
  await db.from("groups").insert({ id, name, student_ids: studentIds });
  invalidateGroups();
  return id;
}

export async function updateGroup(
  id: string,
  name: string,
  studentIds: string[],
): Promise<void> {
  await db.from("groups").update({ name, student_ids: studentIds }).eq("id", id);
  invalidateGroups();
}

export async function deleteGroup(id: string): Promise<void> {
  await db.from("groups").delete().eq("id", id);
  invalidateGroups();
}

export async function ensureStudentInCollegeGroup(
  collegeName: string,
  studentId: string,
): Promise<void> {
  const name = collegeName.trim();
  if (!name) return;

  const { data } = await db
    .from("groups")
    .select("id, student_ids")
    .ilike("name", name)
    .maybeSingle();

  if (data) {
    const group = data as { id: string; student_ids: string[] };
    const ids: string[] = Array.isArray(group.student_ids)
      ? group.student_ids
      : String(group.student_ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.includes(studentId)) {
      await db.from("groups").update({ student_ids: [...ids, studentId] }).eq("id", group.id);
      invalidateGroups();
    }
  } else {
    await appendGroup(name, [studentId]);
  }
}
