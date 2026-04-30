import { unstable_cache } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

export function parseCoachesSheet(rows: string[][]): string[] {
  const [, ...data] = rows;
  return data
    .filter((r) => (r[3] ?? "").trim().toUpperCase() === "TRUE")
    .map((r) => (r[0] ?? "").trim().toLowerCase())
    .filter(Boolean);
}

export async function readActiveCoachEmails(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: "Coaches!A:D",
  });
  return parseCoachesSheet((res.data.values as string[][]) ?? []);
}

export const fetchActiveCoachEmails = unstable_cache(
  readActiveCoachEmails,
  ["coaches:active"],
  { revalidate: 60, tags: ["coaches"] },
);
