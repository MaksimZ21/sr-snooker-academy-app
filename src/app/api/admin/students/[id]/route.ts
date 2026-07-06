import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGroupsAll } from "@/lib/sheets/groups";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForStudent } from "@/lib/sheets/notes";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";
import { fetchAssessments } from "@/lib/sheets/assessments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const { id } = await params;
    const [groups, allStudents] = await Promise.all([
      fetchGroupsAll(),
      fetchStudents(),
    ]);

    const student = allStudents.find((s) => s.id === id);
    if (!student) return new NextResponse("Not found", { status: 404 });

    const studentGroups = groups
      .filter((g) => g.student_ids.includes(id))
      .map((g) => ({ id: g.id, name: g.name, coach_email: g.coach_email }));

    const [notes, attendance, allAssessments] = await Promise.all([
      fetchNotesForStudent(id),
      fetchAttendanceForStudent(id),
      fetchAssessments(),
    ]);

    const studentAssessments = allAssessments.filter(
      (a) =>
        a.participant_phone && student.phone &&
        (a.participant_phone === student.phone ||
          a.participant_name.toLowerCase() === [student.first_name, student.last_name].join(" ").toLowerCase()),
    );

    const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
    const absent = attendance.filter((a) => a.status === "absent").length;

    return NextResponse.json({
      student,
      groups: studentGroups,
      notes,
      assessments: studentAssessments,
      attendance_summary: { present, absent, total: attendance.length },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
