import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, SessionRow, type Session } from "./schemas";

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
