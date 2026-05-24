import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById, updateSessionCoach } from "@/lib/sheets/sessions";
import { fetchAttendanceForSession } from "@/lib/sheets/attendance";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForStudent } from "@/lib/sheets/notes";

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
    const notesByStudent: Record<string, Awaited<ReturnType<typeof fetchNotesForStudent>>> = {};
    await Promise.all(
      sessionStudents.map(async (s) => {
        notesByStudent[s.id] = await fetchNotesForStudent(s.id);
      }),
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
  coach_email: z.string(),
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
    await updateSessionCoach(id, body.coach_email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
