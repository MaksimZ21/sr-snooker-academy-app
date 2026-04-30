import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, SessionRow, type Session } from "./schemas";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const ALL_RANGE = "Sessions!A:I";

async function readAll(): Promise<Session[]> {
  return parseRows(await readSheet(ALL_RANGE), SessionRow);
}

export const fetchSessionsAll = unstable_cache(readAll, ["sessions:all"], {
  revalidate: 60,
  tags: ["sessions:week"],
});

export async function fetchSessionsForCoachToday(email: string, todayIso: string) {
  const all = await fetchSessionsAll();
  return all.filter((s) => s.coach_email === email && s.date === todayIso);
}

export async function fetchSessionsForCoachWeek(
  email: string,
  startIso: string,
  endIso: string,
) {
  const all = await fetchSessionsAll();
  return all.filter(
    (s) => s.coach_email === email && s.date >= startIso && s.date <= endIso,
  );
}

export async function fetchSessionsTodayAll(todayIso: string) {
  const all = await fetchSessionsAll();
  return all.filter((s) => s.date === todayIso);
}

export async function fetchSessionById(id: string) {
  const all = await fetchSessionsAll();
  return all.find((s) => s.id === id) ?? null;
}

export function invalidateSessions() {
  revalidateTag("sessions:week", { expire: 0 });
  revalidateTag("sessions:today", { expire: 0 });
}

export async function appendSession(input: {
  date: string;
  start_time: string;
  end_time: string;
  coach_email: string;
  training_type: string;
  student_ids: string[];
  drive_folder_url?: string;
}) {
  const all = await readSheet(ALL_RANGE);
  const prefix = `SES-${input.date}-`;
  const nums = (all.slice(1) ?? [])
    .map((r) => r[0] ?? "")
    .filter((s) => s.startsWith(prefix))
    .map((s) => {
      const m = s.match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `SES-${input.date}-${String(nextNum).padStart(3, "0")}`;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: ALL_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        id,
        input.date,
        input.start_time,
        input.end_time,
        input.coach_email.trim().toLowerCase(),
        input.training_type,
        (input.student_ids ?? []).join(","),
        input.drive_folder_url ?? "",
        "scheduled",
      ]],
    },
  });
  invalidateSessions();
  return id;
}
