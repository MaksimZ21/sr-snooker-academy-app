import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, GuidelineRow, type Guideline } from "./schemas";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const RANGE_FULL = "Guidelines!A:F";

export const fetchGuidelines = unstable_cache(
  async (): Promise<Guideline[]> => parseRows(await readSheet(RANGE_FULL), GuidelineRow),
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
  const all = await readSheet(RANGE_FULL);
  const ids = (all.slice(1) ?? [])
    .map((r) => r[0] ?? "")
    .filter((s) => /^G\d+$/.test(s))
    .map((s) => parseInt(s.slice(1), 10));
  const nextNum = ids.length ? Math.max(...ids) + 1 : 1;
  const id = `G${String(nextNum).padStart(3, "0")}`;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE_FULL,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        input.category,
        String(input.order),
        input.training_type ?? "",
        input.title,
        input.body_or_link,
      ]],
    },
  });
  revalidateTag("guidelines", { expire: 0 });
  return id;
}
