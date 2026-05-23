import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudents } from "@/lib/sheets/students";
import { ensureStudentInCollegeGroup } from "@/lib/sheets/groups";

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const students = await fetchStudents();
    const withCollege = students.filter((s) => s.active && s.college_name);

    for (const student of withCollege) {
      await ensureStudentInCollegeGroup(student.college_name, student.id);
    }

    return NextResponse.json({ synced: withCollege.length });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
