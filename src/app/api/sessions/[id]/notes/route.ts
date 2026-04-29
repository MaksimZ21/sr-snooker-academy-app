import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { appendNote } from "@/lib/sheets/notes";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const Body = z.object({
  student_id: z.string().min(1),
  text: z.string().min(1).max(2000),
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
    const note = {
      id: randomUUID(),
      student_id: body.student_id,
      session_id: id,
      coach_email: user.email,
      text: body.text,
      created_at: new Date().toISOString(),
    };
    await appendNote(note);
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
