import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/client";

export async function readActiveCoachEmails(): Promise<string[]> {
  const { data } = await db.from("coaches").select("email").eq("active", true);
  return (data ?? []).map((r) => (r.email as string).toLowerCase());
}

export const fetchActiveCoachEmails = unstable_cache(
  readActiveCoachEmails,
  ["coaches:active"],
  { revalidate: 60, tags: ["coaches"] },
);
