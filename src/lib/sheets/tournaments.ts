import { db } from "@/lib/db/client";
import { generatePublicSlug } from "./tournaments-slug";

export type Tournament = {
  id: string;
  name: string;
  // null only for a multi_location tournament — it has no manager coach,
  // only an admin manages it (see isTournamentManager below). Also null
  // for a tournament just created from a CRM event, until an admin fills
  // it in via the edit-tournament dialog.
  manager_email: string | null;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  type: "regular" | "multi_location";
  // Set only for a tournament created from a CRM calendar event — that's
  // what makes it appear on the Schedule (see fetchTournamentsInRange). A
  // manually-created tournament has none of these four CRM fields set.
  event_date: string | null;
  crm_event_id: string;
  crm_appointment_id: string;
  crm_event_type: string;
  created_at: string;
};

export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  // Exactly one of these two is ever set, decided by the parent
  // tournament's type: `regular`/league participants always have
  // student_id (shared student record, shared rating); `multi_location`
  // participants are local to the tournament — a plain name, never a
  // students row, never a rating.
  student_id: string | null;
  local_name: string | null;
  paid: boolean;
  location_id: string | null;
  house_id: string | null;
  created_at: string;
};

export type TournamentParticipantWithStudent = TournamentParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

export type TournamentDetail = {
  tournament: Tournament;
  participants: TournamentParticipantWithStudent[];
};

export function isTournamentManager(tournament: Tournament, user: { email: string; role: string }): boolean {
  if (tournament.type === "multi_location") return user.role === "admin";
  return user.role === "admin" || tournament.manager_email?.trim().toLowerCase() === user.email.trim().toLowerCase();
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data } = await db.from("tournaments").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Tournament[];
}

export async function fetchTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const { data: tournament } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return null;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", id)
    .order("created_at", { ascending: true });

  const participants = (participantRows ?? []) as TournamentParticipant[];
  const studentIds = participants.map((p) => p.student_id).filter((id): id is string => id !== null);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone, rating").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string; rating: number }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    tournament: tournament as Tournament,
    participants: participants.map((p) => ({
      ...p,
      // A local (multi-location) participant was never a student to begin
      // with — that's a different case from "(נמחק)", which means a real
      // student record existed and later got deleted.
      student: p.student_id
        ? (studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "", rating: 1000 })
        : { id: "", first_name: p.local_name ?? "?", last_name: "", phone: "", rating: 1000 },
    })),
  };
}

export async function createTournament(input: {
  name: string;
  // Required for a `regular` tournament, omitted for `multi_location` —
  // enforced by the API route, not here (this function just inserts
  // whatever it's given).
  manager_email?: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
  type?: "regular" | "multi_location";
}): Promise<Tournament> {
  const { data, error } = await db
    .from("tournaments")
    .insert({
      name: input.name,
      manager_email: input.manager_email ?? null,
      rules_url: input.rules_url ?? null,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      type: input.type ?? "regular",
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}

export async function updateTournament(
  id: string,
  input: {
    name?: string;
    manager_email?: string;
    rules_url?: string | null;
    handicap_points_per_rating_gap?: number;
    completed?: boolean;
  },
): Promise<void> {
  const { error } = await db.from("tournaments").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

export async function searchStudents(query: string): Promise<StudentSearchResult[]> {
  const q = query.trim().replace(/,/g, " ");
  if (!q) return [];
  const { data } = await db
    .from("students")
    .select("id, first_name, last_name, phone")
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(15);
  return (data ?? []) as StudentSearchResult[];
}

export async function addTournamentParticipant(
  tournamentId: string,
  input: { studentId?: string; newStudentName?: string; localName?: string },
): Promise<TournamentParticipant> {
  const { data: tournament } = await db.from("tournaments").select("id, type").eq("id", tournamentId).maybeSingle();
  if (!tournament) throw new Error("tournament not found");

  // A multi-location tournament's participants never touch the students
  // table at all — a plain name, local to this tournament, no rating.
  if (tournament.type === "multi_location") {
    if (!input.localName?.trim()) throw new Error("localName is required for a multi-location tournament");
    const { data, error } = await db
      .from("tournament_participants")
      .insert({ tournament_id: tournamentId, local_name: input.localName.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as TournamentParticipant;
  }

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
      public_slug: generatePublicSlug(),
    });
  } else {
    // Existing student — this may be their first-ever tournament, in which
    // case they don't have a public_slug yet. ensurePlayerSlug generates
    // one lazily, exactly once (never overwritten on subsequent
    // tournaments) — same logic an admin can also trigger directly from a
    // student's profile page, extracted to src/lib/sheets/players.ts.
    const { ensurePlayerSlug } = await import("./players");
    await ensurePlayerSlug(studentId);
  }

  const { data, error } = await db
    .from("tournament_participants")
    .insert({ tournament_id: tournamentId, student_id: studentId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("השחקן כבר רשום לטורניר הזה");
    throw new Error(error.message);
  }
  return data as TournamentParticipant;
}

export async function setParticipantPaid(tournamentId: string, participantId: string, paid: boolean): Promise<void> {
  const { error } = await db
    .from("tournament_participants")
    .update({ paid })
    .eq("id", participantId)
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
}

export async function removeTournamentParticipant(tournamentId: string, participantId: string): Promise<void> {
  const { error } = await db
    .from("tournament_participants")
    .delete()
    .eq("id", participantId)
    .eq("tournament_id", tournamentId);
  if (error) throw new Error(error.message);
}

export async function fetchTournamentByCrmAppointmentId(appointmentId: string): Promise<Tournament | null> {
  const { data } = await db
    .from("tournaments")
    .select("*")
    .eq("crm_appointment_id", appointmentId)
    .maybeSingle();
  return (data as Tournament) ?? null;
}

// Only ever returns CRM-created tournaments (event_date is null for every
// manually-created one) — this is exactly what makes a tournament show up
// on the Schedule alongside sessions, for both /admin/schedule and
// /coach/schedule (no manager-based filtering, same as fetchTournaments).
export async function fetchTournamentsInRange(startIso: string, endIso: string): Promise<Tournament[]> {
  const { data } = await db
    .from("tournaments")
    .select("*")
    .not("event_date", "is", null)
    .gte("event_date", startIso)
    .lte("event_date", endIso);
  return (data ?? []) as Tournament[];
}

// A calendar event whose meeting_type marks it as a tournament becomes a
// regular tournament, never multi_location, with no manager yet — an
// admin fills that in afterward via the edit-tournament dialog. Mirrors
// upsertSessionFromCrm's idempotent-by-CRM-id matching (appointment_id
// first, event_id as fallback) so a webhook retry updates the same
// tournament instead of duplicating it — but skips every session-specific
// concept (groups, pricing, attach-to-manual-match) that doesn't apply
// here at all.
export async function upsertTournamentFromCrm(input: {
  crm_event_id: string;
  crm_appointment_id?: string;
  name?: string;
  event_date: string;
  crm_event_type?: string;
}): Promise<{ id: string; action: "created" | "updated" }> {
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("tournaments")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("tournaments")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }

  const fields = {
    name: input.name?.trim() || "טורניר",
    event_date: input.event_date,
    crm_event_id: input.crm_event_id,
    crm_appointment_id: input.crm_appointment_id ?? "",
    crm_event_type: input.crm_event_type ?? "",
  };

  if (existing) {
    const { error } = await db.from("tournaments").update(fields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, action: "updated" };
  }

  const { data, error } = await db
    .from("tournaments")
    .insert({ ...fields, type: "regular", manager_email: null, public_slug: generatePublicSlug() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, action: "created" };
}

// The CRM equivalent of addTournamentParticipant's regular-tournament
// path: someone bought a ticket to a CRM-created tournament, so they join
// the shared students/players table exactly like any other regular
// participant — never a local (multi_location-style) participant, and
// always marked paid, since paying for the ticket is what triggered this
// in the first place. Idempotent: a duplicate delivery of the same
// appointment_approved event for someone already registered is reported
// as a no-op, not an error — a webhook has no one to show a Hebrew error
// toast to.
export async function addTournamentParticipantFromCrm(
  tournamentId: string,
  input: { studentId: string | null; firstName: string; lastName: string; phone: string },
): Promise<{ action: "added" | "already_registered" }> {
  let studentId = input.studentId;

  if (studentId) {
    const { ensurePlayerSlug } = await import("./players");
    await ensurePlayerSlug(studentId);
  } else {
    const { appendStudent } = await import("./students");
    studentId = await appendStudent({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      active: false,
      is_tournament_only: true,
      rating: 1000,
      public_slug: generatePublicSlug(),
    });
  }

  const { error } = await db
    .from("tournament_participants")
    .insert({ tournament_id: tournamentId, student_id: studentId, paid: true });
  if (error) {
    if (error.code === "23505") return { action: "already_registered" };
    throw new Error(error.message);
  }
  return { action: "added" };
}
