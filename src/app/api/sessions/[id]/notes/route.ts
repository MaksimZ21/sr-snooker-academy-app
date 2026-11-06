import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { appendNote, deleteNote } from "@/lib/sheets/notes";
import { randomUUID } from "node:crypto";
import { NOTE_VISIBILITIES } from "@/lib/sheets/schemas";
import { z } from "zod";

const Body = z.object({
  student_id: z.string().min(1),
  text: z.string().min(1).max(2000),
  visibility: z.enum(NOTE_VISIBILITIES).default("student"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireStaff();
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
      visibility: body.visibility,
      created_at: new Date().toISOString(),
    };
    await appendNote(note);
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

const DeleteBody = z.object({ note_id: z.string().min(1) });

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireStaff();
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return new NextResponse("not found", { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const { note_id } = DeleteBody.parse(await req.json());
    await deleteNote(id, note_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
