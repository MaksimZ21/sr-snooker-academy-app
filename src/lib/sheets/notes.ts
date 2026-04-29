import { unstable_cache, revalidateTag } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";
import { readSheet } from "./read";
import { parseRows, NoteRow, type Note } from "./schemas";

const RANGE = "Notes!A:F";

async function readAll(): Promise<Note[]> {
  return parseRows(await readSheet(RANGE), NoteRow);
}

export const fetchNotesAll = unstable_cache(readAll, ["notes:all"], {
  revalidate: 30,
  tags: ["notes:all"],
});

export async function fetchNotesForStudent(studentId: string) {
  return (await fetchNotesAll())
    .filter((n) => n.student_id === studentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function appendNote(row: Note) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.id, row.student_id, row.session_id, row.coach_email, row.text, row.created_at],
      ],
    },
  });
  revalidateTag("notes:all", { expire: 0 });
  revalidateTag(`notes:${row.student_id}`, { expire: 0 });
}
