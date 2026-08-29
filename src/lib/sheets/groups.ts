import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { invalidateSessions } from "./sessions";
import { todayIsoTel } from "@/lib/date";
import type { Group } from "./schemas";

async function readAll(): Promise<Group[]> {
  const { data } = await db.from("groups").select("*").order("name");
  return (data ?? []) as Group[];
}

export const fetchGroupsAll = unstable_cache(readAll, ["groups:all"], {
  revalidate: 60,
  tags: ["groups"],
});

export function invalidateGroups() {
  revalidateTag("groups", { expire: 0 });
}

export async function appendGroup(
  name: string,
  studentIds: string[],
  collegeName?: string,
  coachEmail?: string,
  startTime?: string,
) {
  const { data } = await db.from("groups").select("id");
  const nums = (data ?? [])
    .map((r) => {
      const m = (r.id as string).match(/^GRP-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `GRP-${String(next).padStart(3, "0")}`;
  await db.from("groups").insert({
    id,
    name,
    student_ids: studentIds,
    college_name: collegeName ?? "",
    coach_email: coachEmail ?? "",
    start_time: startTime ?? "",
  });
  invalidateGroups();
  return id;
}

export async function updateGroup(
  id: string,
  name: string,
  studentIds: string[],
  collegeName?: string,
  coachEmail?: string,
  startTime?: string,
): Promise<void> {
  const { data: existing } = await db
    .from("groups")
    .select("student_ids")
    .eq("id", id)
    .maybeSingle();
  const previousIds: string[] = Array.isArray(existing?.student_ids)
    ? (existing!.student_ids as string[])
    : [];

  await db.from("groups").update({
    name,
    student_ids: studentIds,
    college_name: collegeName ?? "",
    coach_email: coachEmail ?? "",
    start_time: startTime ?? "",
  }).eq("id", id);
  invalidateGroups();

  const previousSet = new Set(previousIds);
  const nextSet = new Set(studentIds);
  const added = studentIds.filter((sid) => !previousSet.has(sid));
  const removed = previousIds.filter((sid) => !nextSet.has(sid));
  await syncGroupMembershipToSessions(id, added, removed);
}

export async function deleteGroup(id: string): Promise<void> {
  await db.from("groups").delete().eq("id", id);
  invalidateGroups();
}

function normalizeGroupStudentIds(raw: unknown): string[] {
  return Array.isArray(raw)
    ? (raw as string[])
    : String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function addStudentToGroupRow(groupId: string, studentId: string, currentIds: string[]): Promise<void> {
  if (currentIds.includes(studentId)) return;
  await db.from("groups").update({ student_ids: [...currentIds, studentId] }).eq("id", groupId);
  invalidateGroups();
  await syncGroupMembershipToSessions(groupId, [studentId], []);
}

export async function ensureStudentInCollegeGroup(
  collegeName: string,
  studentId: string,
): Promise<void> {
  const name = collegeName.trim();
  if (!name) return;

  const { data } = await db
    .from("groups")
    .select("id, student_ids")
    .ilike("name", name)
    .maybeSingle();

  if (data) {
    const group = data as { id: string; student_ids: unknown };
    await addStudentToGroupRow(group.id, studentId, normalizeGroupStudentIds(group.student_ids));
  } else {
    await appendGroup(name, [studentId], name);
  }
}

// Unlike ensureStudentInCollegeGroup, this never creates a new group — a
// CRM-supplied college_group value is expected to already match an
// existing group's name exactly (a specific college cohort/time slot, e.g.
// "מכללת ת"א קבוצה 2 - ימי ראשון 20:00"). If no group matches, the student
// is simply left unassigned for an admin to place manually — auto-creating
// a new group per unique CRM string would risk spawning near-duplicate
// groups from typos/formatting drift in the CRM data, per explicit product
// decision (2026-08-28).
export async function assignStudentToExistingGroup(
  groupName: string,
  studentId: string,
): Promise<boolean> {
  const name = groupName.trim();
  if (!name) return false;

  const { data } = await db
    .from("groups")
    .select("id, student_ids")
    .ilike("name", name)
    .maybeSingle();

  if (!data) return false;
  const group = data as { id: string; student_ids: unknown };
  await addStudentToGroupRow(group.id, studentId, normalizeGroupStudentIds(group.student_ids));
  return true;
}

export async function syncGroupMembershipToSessions(
  groupId: string,
  added: string[],
  removed: string[],
): Promise<void> {
  if (added.length === 0 && removed.length === 0) return;

  const today = todayIsoTel();
  const { data } = await db
    .from("sessions")
    .select("id, student_ids")
    .eq("group_id", groupId)
    .gte("date", today)
    .neq("status", "cancelled");

  const sessions = (data ?? []) as { id: string; student_ids: unknown }[];

  for (const session of sessions) {
    const current: string[] = Array.isArray(session.student_ids)
      ? (session.student_ids as string[])
      : [];
    const next = new Set(current);
    let changed = false;

    for (const id of added) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    for (const id of removed) {
      if (next.delete(id)) {
        changed = true;
      }
    }

    if (changed) {
      await db
        .from("sessions")
        .update({ student_ids: Array.from(next) })
        .eq("id", session.id);
    }
  }

  invalidateSessions();
}
