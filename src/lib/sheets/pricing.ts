import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Pricing } from "./schemas";

export const fetchPricing = unstable_cache(
  async (): Promise<Pricing[]> => {
    const { data } = await db
      .from("pricing")
      .select("lesson_type, duration_min, price_nis, notes");
    return (data ?? []) as Pricing[];
  },
  ["pricing:all"],
  { revalidate: 300, tags: ["pricing"] },
);

export async function appendPricing(input: {
  lesson_type: string;
  duration_min: number;
  price_nis: number;
  notes?: string;
}) {
  await db.from("pricing").insert({
    lesson_type: input.lesson_type,
    duration_min: input.duration_min,
    price_nis: input.price_nis,
    notes: input.notes ?? "",
  });
  revalidateTag("pricing", { expire: 0 });
}
