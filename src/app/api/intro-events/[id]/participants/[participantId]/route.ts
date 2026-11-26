import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchIntroEventDetail,
  updateIntroEventParticipant,
  removeIntroEventParticipant,
  canManageIntroEvents,
  INTRO_EXPERIENCE_LEVELS,
  INTRO_GOALS,
} from "@/lib/sheets/intro-events";

const UpdateSchema = z.object({
  experience_level: z.enum(INTRO_EXPERIENCE_LEVELS).nullable().optional(),
  goal: z.enum(INTRO_GOALS).nullable().optional(),
  phone: z.string().max(20).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchIntroEventDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canManageIntroEvents(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = UpdateSchema.parse(await req.json());
    await updateIntroEventParticipant(id, participantId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

// Removes the participant from the event (the student record stays).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    if (!canManageIntroEvents(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, participantId } = await params;
    await removeIntroEventParticipant(id, participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
