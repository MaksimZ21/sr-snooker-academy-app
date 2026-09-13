import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, removeLeagueParticipant, isLeagueManager } from "@/lib/sheets/leagues";
import { assignParticipantToDistrict } from "@/lib/sheets/league-districts";

const AssignSchema = z.object({ districtId: z.string().min(1).nullable() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { districtId } = AssignSchema.parse(await req.json());
    await assignParticipantToDistrict(id, participantId, districtId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await removeLeagueParticipant(id, participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
