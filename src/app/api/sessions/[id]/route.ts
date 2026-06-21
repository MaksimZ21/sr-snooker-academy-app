import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById, updateSessionCoach, updateSessionEndTime } from "@/lib/sheets/sessions";
import { fetchAttendanceForSession } from "@/lib/sheets/attendance";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForMultipleStudents } from "@/lib/sheets/notes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return new NextResponse("not found", { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const [students, attendance] = await Promise.all([
      fetchStudents(),
      fetchAttendanceForSession(id),
    ]);
    const sessionStudents = students.filter((s) =>
      session.student_ids.includes(s.id),
    );
    const notesByStudent = await fetchNotesForMultipleStudents(
      sessionStudents.map((s) => s.id),
    );
    return NextResponse.json({
      session,
      students: sessionStudents,
      attendance,
      notesByStudent,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

const PatchBody = z.object({
  coach_email: z.string().optional(),
  end_time: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    if (body.coach_email !== undefined) await updateSessionCoach(id, body.coach_email);
    if (body.end_time !== undefined) await updateSessionEndTime(id, body.end_time);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
