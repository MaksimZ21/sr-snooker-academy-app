import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Guideline } from "./schemas";

export const fetchGuidelines = unstable_cache(
  async (): Promise<Guideline[]> => {
    const { data } = await db.from("guidelines").select("*").order("order");
    return (data ?? []) as Guideline[];
  },
  ["guidelines:all"],
  { revalidate: 300, tags: ["guidelines"] },
);

export async function appendGuideline(input: {
  category: string;
  order: number;
  training_type?: string;
  title: string;
  body_or_link: string;
}) {
  const { data } = await db.from("guidelines").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `G${String(next).padStart(3, "0")}`;
  await db.from("guidelines").insert({
    id,
    category: input.category,
    order: input.order,
    training_type: input.training_type ?? "",
    title: input.title,
    body_or_link: input.body_or_link,
  });
  revalidateTag("guidelines", { expire: 0 });
  return id;
}
