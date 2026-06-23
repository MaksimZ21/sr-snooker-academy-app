import { db } from "@/lib/db/client";

export type Phrase = { category: string; text: string };

export async function fetchAssessmentPhrases(): Promise<Phrase[]> {
  const { data, error } = await db
    .from("assessment_phrases")
    .select("category, phrase")
    .order("category")
    .order("sort_order");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({ category: r.category as string, text: r.phrase as string }));
}
