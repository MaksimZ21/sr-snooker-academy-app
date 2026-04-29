import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, PricingRow, type Pricing } from "./schemas";

export const fetchPricing = unstable_cache(
  async (): Promise<Pricing[]> => parseRows(await readSheet("Pricing!A:D"), PricingRow),
  ["pricing:all"],
  { revalidate: 300, tags: ["pricing"] },
);
