import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";

export type College = { id: string; name: string };

export const fetchColleges = unstable_cache(
  async (): Promise<College[]> => {
    const { data } = await db.from("colleges").select("*").order("name");
    return (data ?? []) as College[];
  },
  ["colleges:all"],
  { revalidate: 300, tags: ["colleges"] },
);

export async function appendCollege(name: string): Promise<string> {
  const { data } = await db.from("colleges").select("id");
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^COL-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `COL-${String(next).padStart(3, "0")}`;
  await db.from("colleges").insert({ id, name: name.trim() });
  revalidateTag("colleges", { expire: 0 });
  return id;
}

export async function updateCollege(id: string, name: string): Promise<void> {
  await db.from("colleges").update({ name: name.trim() }).eq("id", id);
  revalidateTag("colleges", { expire: 0 });
}

export async function deleteCollege(id: string): Promise<void> {
  await db.from("colleges").delete().eq("id", id);
  revalidateTag("colleges", { expire: 0 });
}
