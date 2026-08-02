import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Session } from "./schemas";

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return "";
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function readAll(): Promise<Session[]> {
  const { data } = await db.from("sessions").select("*");
  return (data ?? []) as Session[];
}

export const fetchSessionsAll = unstable_cache(readAll, ["sessions:all"], {
  revalidate: 60,
  tags: ["sessions:week"],
});

export const fetchSessionsForCoachToday = unstable_cache(
  async (email: string, todayIso: string): Promise<Session[]> => {
    const { data } = await db.from("sessions").select("*")
      .eq("coach_email", email).eq("date", todayIso);
    return (data ?? []) as Session[];
  },
  ["sessions:coach-today"],
  { revalidate: 60, tags: ["sessions:week", "sessions:today"] },
);

export const fetchSessionsForCoachWeek = unstable_cache(
  async (email: string, startIso: string, endIso: string): Promise<Session[]> => {
    const { data } = await db.from("sessions").select("*")
      .eq("coach_email", email).gte("date", startIso).lte("date", endIso);
    return (data ?? []) as Session[];
  },
  ["sessions:coach-week"],
  { revalidate: 60, tags: ["sessions:week"] },
);

export const fetchSessionsForCoach = unstable_cache(
  async (email: string): Promise<Session[]> => {
    const { data } = await db.from("sessions").select("*")
      .eq("coach_email", email)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });
    return (data ?? []) as Session[];
  },
  ["sessions:coach"],
  { revalidate: 60, tags: ["sessions:week"] },
);

export const fetchSessionsTodayAll = unstable_cache(
  async (todayIso: string): Promise<Session[]> => {
    const { data } = await db.from("sessions").select("*").eq("date", todayIso);
    return (data ?? []) as Session[];
  },
  ["sessions:today-all"],
  { revalidate: 60, tags: ["sessions:week", "sessions:today"] },
);

export const fetchSessionsForDateRange = unstable_cache(
  async (startIso: string, endIso: string, coachEmail?: string): Promise<Session[]> => {
    const q = db.from("sessions").select("*").gte("date", startIso).lte("date", endIso);
    const { data } = await (coachEmail ? q.eq("coach_email", coachEmail) : q);
    return (data ?? []) as Session[];
  },
  ["sessions:range"],
  { revalidate: 60, tags: ["sessions:week"] },
);

export async function fetchSessionsByIds(ids: string[]): Promise<Session[]> {
  if (ids.length === 0) return [];
  const { data } = await db.from("sessions").select("*").in("id", ids);
  return (data ?? []) as Session[];
}

export async function fetchSessionById(id: string) {
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Session) ?? null;
}

export async function fetchSessionByCrmAppointmentId(appointmentId: string): Promise<Session | null> {
  const { data } = await db
    .from("sessions")
    .select("*")
    .eq("crm_appointment_id", appointmentId)
    .maybeSingle();
  return (data as Session) ?? null;
}

export async function updateSessionCoach(sessionId: string, coachEmail: string): Promise<void> {
  await db
    .from("sessions")
    .update({ coach_email: coachEmail.trim().toLowerCase() })
    .eq("id", sessionId);
  invalidateSessions();
}

export async function updateSessionEndTime(sessionId: string, endTime: string): Promise<void> {
  await db.from("sessions").update({ end_time: endTime.trim() }).eq("id", sessionId);
  invalidateSessions();
}

export async function updateSession(
  id: string,
  input: {
    date?: string;
    start_time?: string;
    end_time?: string;
    coach_email?: string;
    training_type?: string;
    status?: string;
  },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.start_time !== undefined) patch.start_time = input.start_time;
  if (input.end_time !== undefined) patch.end_time = input.end_time;
  if (input.coach_email !== undefined) patch.coach_email = input.coach_email.trim().toLowerCase();
  if (input.training_type !== undefined) patch.training_type = input.training_type;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return;
  await db.from("sessions").update(patch).eq("id", id);
  invalidateSessions();
}

export async function deleteSession(id: string): Promise<void> {
  await db.from("sessions").delete().eq("id", id);
  invalidateSessions();
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
  group_id?: string | null;
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
    group_id: input.group_id ?? null,
    status: "scheduled",
  });
  invalidateSessions();
  return id;
}

export async function setSessionStudents(sessionId: string, studentIds: string[]) {
  await db.from("sessions").update({ student_ids: studentIds }).eq("id", sessionId);
  invalidateSessions();
}

export const fetchSessionsForStudent = unstable_cache(
  async (studentId: string): Promise<Session[]> => {
    const { data } = await db.from("sessions").select("*")
      .contains("student_ids", [studentId])
      .order("date").order("start_time");
    return (data ?? []) as Session[];
  },
  ["sessions:student"],
  { revalidate: 60, tags: ["sessions:week"] },
);

export async function upsertSessionFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  name?: string;
  date: string;
  start_time: string;
  end_time?: string;
  training_type?: string;
  address?: string;
  crm_event_type?: string;
  group_name?: string;
}): Promise<{ id: string; action: "created" | "updated" }> {
  // Resolve existing session.
  // appointment_id is unique per occurrence — use it when available, never fall back to event_id.
  // event_id identifies the recurring series and is reused across sessions, so only use it as
  // a fallback when no appointment_id was provided (legacy / non-recurring events).
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  // Resolve group → student_ids + coach_email
  // First tries exact match, then checks if any group name is contained within the CRM name
  // (e.g. CRM sends "מכללה חיפה" but group is named "חיפה")
  let studentIds: string[] = [];
  let resolvedCoachEmail = "";
  if (input.group_name) {
    const { data: allGroups } = await db.from("groups").select("name, student_ids, coach_email");
    const groups = (allGroups ?? []) as { name: string; student_ids: unknown; coach_email: string }[];
    const crmName = input.group_name.trim().toLowerCase();
    const matched =
      groups.find((g) => g.name.trim().toLowerCase() === crmName) ??
      groups.find((g) => crmName.includes(g.name.trim().toLowerCase()));
    if (matched) {
      const raw = matched.student_ids as unknown;
      studentIds = Array.isArray(raw)
        ? (raw as string[])
        : String(raw ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
      resolvedCoachEmail = matched.coach_email ?? "";
    }
  }

  const endTime = input.end_time || addMinutes(input.start_time, 90);

  const fields = {
    name: input.name ?? "",
    date: input.date,
    start_time: input.start_time,
    end_time: endTime,
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
  };

  if (existing) {
    const updateData = {
      ...fields,
      ...(studentIds.length > 0 && { student_ids: studentIds }),
      ...(resolvedCoachEmail && { coach_email: resolvedCoachEmail }),
    };
    await db.from("sessions").update(updateData).eq("id", existing.id);
    invalidateSessions();
    return { id: existing.id as string, action: "updated" };
  }

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
    ...fields,
    coach_email: resolvedCoachEmail,
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
  });
  invalidateSessions();
  return { id, action: "created" };
}
