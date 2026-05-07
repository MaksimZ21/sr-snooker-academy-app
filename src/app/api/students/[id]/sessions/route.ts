import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";
import { fetchSessionsAll } from "@/lib/sheets/sessions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const [attendance, sessions] = await Promise.all([
      fetchAttendanceForStudent(id),
      fetchSessionsAll(),
    ]);
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const rows = attendance
      .map((a) => {
        const session = sessionMap.get(a.session_id);
        if (!session) return null;
        return { session, attendance_status: a.status };
      })
      .filter(Boolean)
      .sort((a, b) =>
        b!.session.date.localeCompare(a!.session.date) ||
        b!.session.start_time.localeCompare(a!.session.start_time),
      );
    return NextResponse.json({ sessions: rows });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
