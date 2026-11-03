import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { canManageLeagues } from "@/lib/sheets/leagues";
import { deleteLeagueBreak } from "@/lib/sheets/league-breaks";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; breakId: string }> },
) {
  try {
    const user = await requireUser();
    if (!canManageLeagues(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, breakId } = await params;
    await deleteLeagueBreak(id, breakId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
