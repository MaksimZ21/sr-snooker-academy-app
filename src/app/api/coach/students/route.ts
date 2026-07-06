import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForMultipleStudents } from "@/lib/sheets/notes";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "coach") return new NextResponse("Forbidden", { status: 403 });

    const [groups, allStudents] = await Promise.all([
      fetchGroupsAll(),
      fetchStudents(),
    ]);

    const myGroups = groups.filter((g) => g.coach_email === user.email);

    const studentGroupMap: Record<string, { id: string; name: string }[]> = {};
    for (const group of myGroups) {
      for (const sid of group.student_ids) {
        if (!studentGroupMap[sid]) studentGroupMap[sid] = [];
        studentGroupMap[sid].push({ id: group.id, name: group.name });
      }
    }

    const studentIds = Object.keys(studentGroupMap);
    const students = allStudents.filter((s) => studentIds.includes(s.id));
    const notesByStudent = await fetchNotesForMultipleStudents(studentIds);

    const result = students.map((s) => ({
      ...s,
      groups: studentGroupMap[s.id] ?? [],
      notes_count: notesByStudent[s.id]?.length ?? 0,
    }));

    return NextResponse.json({ students: result });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
