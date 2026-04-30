import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, PricingRow, type Pricing } from "./schemas";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const RANGE_FULL = "Pricing!A:D";

export const fetchPricing = unstable_cache(
  async (): Promise<Pricing[]> => parseRows(await readSheet(RANGE_FULL), PricingRow),
  ["pricing:all"],
  { revalidate: 300, tags: ["pricing"] },
);

export async function appendPricing(input: {
  lesson_type: string;
  duration_min: number;
  price_nis: number;
  notes?: string;
}) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE_FULL,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        input.lesson_type,
        String(input.duration_min),
        String(input.price_nis),
        input.notes ?? "",
      ]],
    },
  });
  revalidateTag("pricing", { expire: 0 });
}
