import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, GuidelineRow, type Guideline } from "./schemas";

export const fetchGuidelines = unstable_cache(
  async (): Promise<Guideline[]> => parseRows(await readSheet("Guidelines!A:F"), GuidelineRow),
  ["guidelines:all"],
  { revalidate: 300, tags: ["guidelines"] },
);
