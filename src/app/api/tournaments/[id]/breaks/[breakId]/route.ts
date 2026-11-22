import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { deleteTournamentBreak } from "@/lib/sheets/tournament-breaks";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; breakId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, breakId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteTournamentBreak(id, breakId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
