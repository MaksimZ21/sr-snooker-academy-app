import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { setParticipantNote, PARTICIPANT_NOTE_MAX_LENGTH } from "@/lib/sheets/tournament-participant-notes";

type NoteResponse = { ok: true } | { error: string };

const PutSchema = z.object({ text: z.string().max(PARTICIPANT_NOTE_MAX_LENGTH) });

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireStaff();
    const { id, participantId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json<NoteResponse>({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json<NoteResponse>({ error: "Forbidden" }, { status: 403 });
    }
    if (!detail.participants.some((p) => p.id === participantId)) {
      return NextResponse.json<NoteResponse>({ error: "not in this tournament" }, { status: 404 });
    }
    const { text } = PutSchema.parse(await req.json());
    await setParticipantNote(id, participantId, text, user.email);
    return NextResponse.json<NoteResponse>({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return NextResponse.json<NoteResponse>({ error: "bad request" }, { status: 400 });
    return NextResponse.json<NoteResponse>({ error: "internal error" }, { status: 500 });
  }
}
