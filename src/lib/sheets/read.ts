import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

export async function readSheet(range: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range,
  });
  return (res.data.values as string[][]) ?? [];
}
