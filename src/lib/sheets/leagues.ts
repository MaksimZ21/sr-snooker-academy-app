import { db } from "@/lib/db/client";
import { generatePublicSlug } from "./tournaments-slug";
import { districtHasFixtures, type LeagueDistrict } from "./league-districts";

export type League = {
  id: string;
  name: string;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export type LeagueParticipant = {
  id: string;
  league_id: string;
  student_id: string;
  district_id: string | null;
  created_at: string;
};

export type LeagueParticipantWithStudent = LeagueParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

export type LeagueDetail = {
  league: League;
  participants: LeagueParticipantWithStudent[];
  districts: LeagueDistrict[];
};

// Unlike tournaments, a league has no per-league manager coach — the admin
// manages every league directly. Kept as a named helper (rather than an
// inline `user.role === "admin"` check at every call site) so every league
// route reads the same way and stays easy to grep for.
export function canManageLeagues(user: { role: string }): boolean {
  return user.role === "admin";
}

export async function fetchLeagues(): Promise<League[]> {
  const { data } = await db.from("leagues").select("*").order("created_at", { ascending: false });
  return (data ?? []) as League[];
}

export async function createLeague(input: {
  name: string;
  handicap_points_per_rating_gap?: number;
}): Promise<League> {
  const { data, error } = await db
    .from("leagues")
    .insert({
      name: input.name,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as League;
}

export async function updateLeague(id: string, input: { name?: string; completed?: boolean }): Promise<void> {
  const { error } = await db.from("leagues").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchLeagueDetail(id: string): Promise<LeagueDetail | null> {
  const { data: league } = await db.from("leagues").select("*").eq("id", id).maybeSingle();
  if (!league) return null;

  const [{ data: participantRows }, { data: districtRows }] = await Promise.all([
    db.from("league_participants").select("*").eq("league_id", id).order("created_at", { ascending: true }),
    db.from("league_districts").select("*").eq("league_id", id).order("label"),
  ]);

  const participants = (participantRows ?? []) as LeagueParticipant[];
  const studentIds = participants.map((p) => p.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone, rating").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string; rating: number }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    league: league as League,
    participants: participants.map((p) => ({
      ...p,
      student: studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "", rating: 1000 },
    })),
    districts: (districtRows ?? []) as LeagueDistrict[],
  };
}

export async function addLeagueParticipant(
  leagueId: string,
  input: { studentId?: string; newStudentName?: string },
): Promise<LeagueParticipant> {
  const { appendStudent } = await import("./students");
  const { ensurePlayerSlug } = await import("./players");
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
    await ensurePlayerSlug(studentId);
  }

  const { data, error } = await db
    .from("league_participants")
    .insert({ league_id: leagueId, student_id: studentId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("השחקן כבר רשום לליגה הזו");
    throw new Error(error.message);
  }
  return data as LeagueParticipant;
}

export async function removeLeagueParticipant(leagueId: string, participantId: string): Promise<void> {
  const { data: participant } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.league_id !== leagueId) throw new Error("participant not found");

  if (participant.district_id && (await districtHasFixtures(participant.district_id as string))) {
    throw new Error("cannot remove a participant whose district already has a fixture schedule");
  }

  const { error } = await db.from("league_participants").delete().eq("id", participantId).eq("league_id", leagueId);
  if (error) throw new Error(error.message);
}
