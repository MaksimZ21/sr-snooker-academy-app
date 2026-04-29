import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { upsertAttendance } from "@/lib/sheets/attendance";
import { z } from "zod";

const Body = z.object({
  student_id: z.string().min(1),
  status: z.enum(["present", "absent", "late"]),
});

export async function POST(
  req: Request,
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
    const body = Body.parse(await req.json());
    if (!session.student_ids.includes(body.student_id)) {
      return new NextResponse("student not in session", { status: 400 });
    }
    await upsertAttendance({
      session_id: id,
      student_id: body.student_id,
      status: body.status,
      marked_by: user.email,
      marked_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
