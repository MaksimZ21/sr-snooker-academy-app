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
