import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForStudent } from "@/lib/sheets/notes";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "coach") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await params;
    const [groups, allStudents] = await Promise.all([
      fetchGroupsAll(),
      fetchStudents(),
    ]);

    const myGroups = groups.filter((g) => g.coach_email === user.email);
    const myStudentIds = new Set(myGroups.flatMap((g) => g.student_ids));
    if (!myStudentIds.has(id)) return new NextResponse("Forbidden", { status: 403 });

    const student = allStudents.find((s) => s.id === id);
    if (!student) return new NextResponse("Not found", { status: 404 });

    const studentGroups = myGroups
      .filter((g) => g.student_ids.includes(id))
      .map((g) => ({ id: g.id, name: g.name }));

    const [notes, attendance] = await Promise.all([
      fetchNotesForStudent(id),
      fetchAttendanceForStudent(id),
    ]);

    const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
    const absent = attendance.filter((a) => a.status === "absent").length;

    return NextResponse.json({
      student,
      groups: studentGroups,
      notes,
      attendance_summary: { present, absent, total: attendance.length },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
