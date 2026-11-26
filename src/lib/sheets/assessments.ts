import { db } from "@/lib/db/client";
export type { TechniqueKey, Technique, TechniqueRating, Assessment } from "./assessment-types";
export { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "./assessment-types";
import type { Assessment } from "./assessment-types";
import { assessmentMatchesStudent } from "./assessment-match";
import { getStudentByEmail } from "./students";

export async function fetchAssessments(coachEmail?: string): Promise<Assessment[]> {
  let q = db
    .from("assessments")
    .select("*")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (coachEmail) q = q.eq("coach_email", coachEmail);
  const { data } = await q;
  return (data ?? []) as Assessment[];
}

// The reports written for this student at intro events, matched on phone +
// exact full name (see assessmentMatchesStudent). Phones in assessments are
// stored as typed, so the match runs here rather than as a DB filter.
export async function fetchAssessmentsForStudent(student: {
  first_name: string;
  last_name: string;
  phone: string | null | undefined;
}): Promise<Assessment[]> {
  if (!student.phone) return [];
  const all = await fetchAssessments();
  return all.filter((a) => assessmentMatchesStudent(a, student));
}

// For API routes: may this logged-in student open this assessment?
export async function studentCanSeeAssessment(email: string, a: Assessment): Promise<boolean> {
  const student = await getStudentByEmail(email);
  return !!student && assessmentMatchesStudent(a, student);
}

export async function fetchAssessmentById(id: string): Promise<Assessment | null> {
  const { data } = await db.from("assessments").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as Assessment | null;
}

export async function createAssessment(
  input: Omit<Assessment, "id" | "created_at">,
): Promise<Assessment> {
  const { data, error } = await db.from("assessments").insert(input).select().single();
  if (error) throw new Error(error.message);
  return data as Assessment;
}

export type AssessmentUpdate = Partial<
  Pick<
    Assessment,
    "participant_name" | "participant_phone" | "event_date" | "strong_hand" | "strong_eye" | "technique" | "notes" | "photo_url"
  >
>;

export async function updateAssessment(id: string, input: AssessmentUpdate): Promise<Assessment> {
  const { data, error } = await db.from("assessments").update(input).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Assessment;
}
