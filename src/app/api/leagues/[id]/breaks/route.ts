import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, canManageLeagues } from "@/lib/sheets/leagues";
import { fetchLeagueBreaks, addLeagueBreak } from "@/lib/sheets/league-breaks";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const breaks = await fetchLeagueBreaks(id);
    return NextResponse.json({ breaks });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const AddSchema = z.object({
  participantId: z.string().min(1),
  value: z.number().int().min(1).max(155),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canManageLeagues(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { participantId, value } = AddSchema.parse(await req.json());
    await addLeagueBreak(id, participantId, value);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
