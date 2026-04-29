import { unstable_cache, revalidateTag } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";
import { readSheet } from "./read";
import { parseRows, AttendanceRow, type Attendance } from "./schemas";

const RANGE = "Attendance!A:E";

async function readAll(): Promise<Attendance[]> {
  return parseRows(await readSheet(RANGE), AttendanceRow);
}

export const fetchAttendanceAll = unstable_cache(readAll, ["attendance:all"], {
  revalidate: 30,
  tags: ["attendance:all"],
});

export async function fetchAttendanceForSession(sessionId: string) {
  return (await fetchAttendanceAll()).filter((a) => a.session_id === sessionId);
}

export async function appendAttendance(row: Attendance) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.session_id, row.student_id, row.status, row.marked_by, row.marked_at],
      ],
    },
  });
  revalidateTag("attendance:all", { expire: 0 });
  revalidateTag(`attendance:${row.session_id}`, { expire: 0 });
}

export async function upsertAttendance(row: Attendance) {
  const sheets = getSheetsClient();
  const all = await readAll();
  const idx = all.findIndex(
    (a) => a.session_id === row.session_id && a.student_id === row.student_id,
  );
  if (idx === -1) {
    await appendAttendance(row);
    return;
  }
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Attendance!A${sheetRow}:E${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.session_id, row.student_id, row.status, row.marked_by, row.marked_at],
      ],
    },
  });
  revalidateTag("attendance:all", { expire: 0 });
  revalidateTag(`attendance:${row.session_id}`, { expire: 0 });
}
