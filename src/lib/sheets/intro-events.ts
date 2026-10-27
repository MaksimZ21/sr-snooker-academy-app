import { db } from "@/lib/db/client";

export const INTRO_EXPERIENCE_LEVELS = ["none", "hobbyist", "regular"] as const;
export type IntroExperienceLevel = (typeof INTRO_EXPERIENCE_LEVELS)[number];
export const INTRO_EXPERIENCE_LEVEL_LABEL: Record<IntroExperienceLevel, string> = {
  none: "ללא ניסיון בכלל",
  hobbyist: "שחקן חובבן",
  regular: "שחקן קבוע",
};

export const INTRO_GOALS = ["cue_control", "technique", "angles", "beat_friend", "advance", "basics"] as const;
export type IntroGoal = (typeof INTRO_GOALS)[number];
export const INTRO_GOAL_LABEL: Record<IntroGoal, string> = {
  cue_control: "שליטה בלבן",
  technique: "טכניקה",
  angles: "זוויות",
  beat_friend: "לנצח חבר/ים",
  advance: "להתקדם מקצועית",
  basics: "בסיס של הבסיס",
};

export type IntroEvent = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  coach_email: string | null;
  crm_event_id: string;
  crm_appointment_id: string;
  crm_event_type: string;
  created_at: string;
};

export type IntroEventParticipant = {
  id: string;
  intro_event_id: string;
  student_id: string;
  experience_level: IntroExperienceLevel | null;
  goal: IntroGoal | null;
  created_at: string;
};

export type IntroEventParticipantWithStudent = IntroEventParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string };
};

export type IntroEventDetail = {
  event: IntroEvent;
  participants: IntroEventParticipantWithStudent[];
};

// Admin-only — unlike tournaments, an intro event has no per-event manager
// coach concept of its own; the admin assigns coach_email by hand and
// manages every intro event directly. Mirrors leagues.ts's
// canManageLeagues exactly (deliberately extensible later if a coach
// should ever manage their own intro event, same as leagues).
export function canManageIntroEvents(user: { role: string }): boolean {
  return user.role === "admin";
}

export async function fetchIntroEvents(): Promise<IntroEvent[]> {
  const { data } = await db.from("intro_events").select("*").order("event_date", { ascending: false });
  return (data ?? []) as IntroEvent[];
}

export async function fetchIntroEventDetail(id: string): Promise<IntroEventDetail | null> {
  const { data: event } = await db.from("intro_events").select("*").eq("id", id).maybeSingle();
  if (!event) return null;

  const { data: participantRows } = await db
    .from("intro_event_participants")
    .select("*")
    .eq("intro_event_id", id)
    .order("created_at", { ascending: true });
  const participants = (participantRows ?? []) as IntroEventParticipant[];

  const studentIds = participants.map((p) => p.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    event: event as IntroEvent,
    participants: participants.map((p) => ({
      ...p,
      student: studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "" },
    })),
  };
}

export async function updateIntroEventCoach(id: string, coachEmail: string | null): Promise<void> {
  const { error } = await db.from("intro_events").update({ coach_email: coachEmail }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addIntroEventParticipant(
  introEventId: string,
  input: { studentId?: string; newStudentName?: string },
): Promise<IntroEventParticipant> {
  const { appendStudent } = await import("./students");
  let studentId = input.studentId;

  if (!studentId) {
    if (!input.newStudentName?.trim()) throw new Error("studentId or newStudentName required");
    studentId = await appendStudent({
      first_name: input.newStudentName.trim(),
      last_name: "",
      active: false,
      is_tournament_only: true,
      rating: 1000,
    });
  }

  const { data, error } = await db
    .from("intro_event_participants")
    .insert({ intro_event_id: introEventId, student_id: studentId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("השחקן כבר רשום לאירוע הזה");
    throw new Error(error.message);
  }
  return data as IntroEventParticipant;
}

export async function updateIntroEventParticipant(
  introEventId: string,
  participantId: string,
  input: { experience_level?: IntroExperienceLevel | null; goal?: IntroGoal | null },
): Promise<void> {
  const { data: participant } = await db
    .from("intro_event_participants")
    .select("id, intro_event_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.intro_event_id !== introEventId) throw new Error("participant not found");

  const { error } = await db.from("intro_event_participants").update(input).eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function fetchIntroEventByCrmAppointmentId(appointmentId: string): Promise<IntroEvent | null> {
  const { data } = await db
    .from("intro_events")
    .select("*")
    .eq("crm_appointment_id", appointmentId)
    .maybeSingle();
  return (data as IntroEvent) ?? null;
}

// Only intro events ever have an event_date (always set — unlike
// tournaments, there's no manually-created intro event), so this is
// exactly what makes one show up on the Schedule for both
// /admin/schedule and /coach/schedule (no coach-based filtering, same as
// fetchTournamentsInRange).
export async function fetchIntroEventsInRange(startIso: string, endIso: string): Promise<IntroEvent[]> {
  const { data } = await db
    .from("intro_events")
    .select("*")
    .gte("event_date", startIso)
    .lte("event_date", endIso);
  return (data ?? []) as IntroEvent[];
}

// A calendar event whose meeting_type marks it as an intro event becomes
// an intro_events row with no coach yet — an admin fills that in
// afterward via the detail page. Mirrors upsertTournamentFromCrm's
// idempotent-by-CRM-id matching and 23505 race fallback exactly.
export async function upsertIntroEventFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  name?: string;
  event_date: string;
  start_time: string;
  crm_event_type?: string;
}): Promise<{ id: string; action: "created" | "updated" }> {
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("intro_events")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("intro_events")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  const fields = {
    name: input.name?.trim() || "אירוע היכרות",
    event_date: input.event_date,
    start_time: input.start_time,
    crm_event_id: input.crm_event_id,
    crm_appointment_id: input.crm_appointment_id ?? "",
    crm_event_type: input.crm_event_type ?? "",
  };

  let id: string;
  let action: "created" | "updated";

  if (existing) {
    const { error } = await db.from("intro_events").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    id = existing.id;
    action = "updated";
  } else {
    const { data, error } = await db
      .from("intro_events")
      .insert({ ...fields, coach_email: null })
      .select("id")
      .single();
    if (error) {
      // Race: a concurrent duplicate delivery of the same CRM event
      // inserted first — fall back to the row that won, instead of
      // creating a second intro event for the same appointment.
      if (error.code === "23505" && input.crm_appointment_id) {
        const { data: winner } = await db
          .from("intro_events")
          .select("id")
          .eq("crm_appointment_id", input.crm_appointment_id)
          .maybeSingle();
        if (!winner) throw new Error(error.message);
        id = winner.id as string;
        action = "updated";
      } else {
        throw new Error(error.message);
      }
    } else {
      id = data.id as string;
      action = "created";
    }
  }

  if (input.crm_appointment_id) {
    await drainPendingIntroRegistrations(id, input.crm_appointment_id);
  }
  return { id, action };
}

async function findStudentIdByPhone(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const core = digits.startsWith("972") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  const { data } = await db
    .from("students")
    .select("id")
    .or(`phone.eq.0${core},phone.eq.972${core}`)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

// The CRM equivalent of addIntroEventParticipant's manual-add path:
// someone registered for a CRM-created intro event, so they join the
// shared students table exactly like a CRM tournament ticket buyer does
// (addTournamentParticipantFromCrm) — is_tournament_only: true, no
// public_slug (no public page exists for intro events). Idempotent: a
// duplicate appointment_approved delivery for someone already registered
// is reported as a no-op, not an error.
export async function addIntroEventParticipantFromCrm(
  introEventId: string,
  input: { firstName: string; lastName: string; phone: string },
): Promise<{ action: "added" | "already_registered" }> {
  let studentId = input.phone ? await findStudentIdByPhone(input.phone) : null;

  if (!studentId) {
    const { appendStudent } = await import("./students");
    studentId = await appendStudent({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      active: false,
      is_tournament_only: true,
      rating: 1000,
    });
  }

  const { error } = await db
    .from("intro_event_participants")
    .insert({ intro_event_id: introEventId, student_id: studentId });
  if (error) {
    if (error.code === "23505") return { action: "already_registered" };
    throw new Error(error.message);
  }
  return { action: "added" };
}

// Attaches every registration parked for this appointment (in the
// generic, entity-agnostic crm_pending_registrations table already used
// by tournaments) to the now-existing intro event, then clears them.
// Safe to share that table with tournaments: a given appointment_id only
// ever resolves to exactly one of session/tournament/intro-event, so only
// one of upsertTournamentFromCrm/upsertIntroEventFromCrm will ever drain
// a given row.
async function drainPendingIntroRegistrations(introEventId: string, appointmentId: string): Promise<void> {
  const { data: pending } = await db
    .from("crm_pending_registrations")
    .select("id, first_name, last_name, phone")
    .eq("appointment_id", appointmentId);
  const rows = (pending ?? []) as { id: number; first_name: string; last_name: string; phone: string }[];
  if (rows.length === 0) return;

  for (const row of rows) {
    await addIntroEventParticipantFromCrm(introEventId, {
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
    });
  }
  await db.from("crm_pending_registrations").delete().eq("appointment_id", appointmentId);
}
