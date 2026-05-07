import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Session } from "./schemas";

async function readAll(): Promise<Session[]> {
  const { data } = await db.from("sessions").select("*");
  return (data ?? []) as Session[];
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

export async function fetchSessionsForCoach(email: string) {
  const all = await fetchSessionsAll();
  return all
    .filter((s) => s.coach_email === email)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
}

export async function fetchSessionsTodayAll(todayIso: string) {
  const all = await fetchSessionsAll();
  return all.filter((s) => s.date === todayIso);
}

export async function fetchSessionById(id: string) {
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Session) ?? null;
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
  const prefix = `SES-${input.date}-`;
  const { data } = await db.from("sessions").select("id").like("id", `${prefix}%`);
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^SES-\d{4}-\d{2}-\d{2}-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `${prefix}${String(next).padStart(3, "0")}`;
  await db.from("sessions").insert({
    id,
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    coach_email: input.coach_email.trim().toLowerCase(),
    training_type: input.training_type,
    student_ids: input.student_ids,
    drive_folder_url: input.drive_folder_url ?? "",
    status: "scheduled",
  });
  invalidateSessions();
  return id;
}

export async function setSessionStudents(sessionId: string, studentIds: string[]) {
  await db.from("sessions").update({ student_ids: studentIds }).eq("id", sessionId);
  invalidateSessions();
}
