import { db } from "@/lib/db/client";
export type { TechniqueKey, Technique, Assessment } from "./assessment-types";
export { TECHNIQUE_CRITERIA } from "./assessment-types";
import type { Assessment } from "./assessment-types";

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
