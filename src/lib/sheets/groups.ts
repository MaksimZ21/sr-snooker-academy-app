import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { GroupRow, type Group } from "./schemas";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const RANGE = "Groups!A:C";

async function readAll(): Promise<Group[]> {
  const rows = await readSheet(RANGE);
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data
    .filter((r) => r[0]?.trim())
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((col, i) => (obj[col] = r[i] ?? ""));
      return GroupRow.parse(obj);
    });
}

export const fetchGroupsAll = unstable_cache(readAll, ["groups:all"], {
  revalidate: 60,
  tags: ["groups"],
});

export function invalidateGroups() {
  revalidateTag("groups", { expire: 0 });
}

export async function appendGroup(
  name: string,
  studentIds: string[],
): Promise<string> {
  const all = await readSheet(RANGE);
  const nums = all
    .slice(1)
    .map((r) => r[0] ?? "")
    .filter((s) => s.startsWith("GRP-"))
    .map((s) => {
      const m = s.match(/^GRP-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `GRP-${String(nextNum).padStart(3, "0")}`;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[id, name, studentIds.join(",")]] },
  });
  invalidateGroups();
  return id;
}

export async function updateGroup(
  id: string,
  name: string,
  studentIds: string[],
): Promise<void> {
  const sheets = getSheetsClient();
  const all = await readSheet(RANGE);
  const idx = all.slice(1).findIndex((r) => r[0] === id);
  if (idx === -1) throw new Error("group not found");
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Groups!A${sheetRow}:C${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[id, name, studentIds.join(",")]] },
  });
  invalidateGroups();
}

export async function deleteGroup(id: string): Promise<void> {
  const sheets = getSheetsClient();
  const all = await readSheet(RANGE);
  const idx = all.slice(1).findIndex((r) => r[0] === id);
  if (idx === -1) return;
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Groups!A${sheetRow}:C${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["", "", ""]] },
  });
  invalidateGroups();
}
