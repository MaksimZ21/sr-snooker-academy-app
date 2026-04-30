import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, StudentRow, type Student } from "./schemas";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const RANGE_FULL = "Students!A:G";

export const fetchStudents = unstable_cache(
  async (): Promise<Student[]> => parseRows(await readSheet(RANGE_FULL), StudentRow),
  ["students:all"],
  { revalidate: 300, tags: ["students"] },
);

export async function appendStudent(input: {
  name: string;
  phone?: string;
  parent_name?: string;
  parent_phone?: string;
  general_notes?: string;
}) {
  const all = await readSheet(RANGE_FULL);
  const ids = (all.slice(1) ?? [])
    .map((r) => r[0] ?? "")
    .filter((s) => /^S\d+$/.test(s))
    .map((s) => parseInt(s.slice(1), 10));
  const nextNum = ids.length ? Math.max(...ids) + 1 : 1;
  const id = `S${String(nextNum).padStart(3, "0")}`;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE_FULL,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        input.name,
        input.phone ?? "",
        input.parent_name ?? "",
        input.parent_phone ?? "",
        input.general_notes ?? "",
        "TRUE",
      ]],
    },
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
