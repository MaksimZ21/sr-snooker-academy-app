import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { enterHouseMatchResult } from "@/lib/sheets/tournament-houses";

const ResultSchema = z
  .object({
    framesA: z.number().int().nonnegative(),
    framesB: z.number().int().nonnegative(),
  })
  .refine((v) => v.framesA !== v.framesB, { message: "a match cannot end in a tie" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, matchId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { framesA, framesB } = ResultSchema.parse(await req.json());
    await enterHouseMatchResult(id, matchId, framesA, framesB);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
