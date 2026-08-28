import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, updateTournament, isTournamentManager } from "@/lib/sheets/tournaments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  manager_email: z.email().optional(),
  rules_url: z.string().nullable().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = UpdateSchema.parse(await req.json());
    if (user.role !== "admin" && (body.manager_email !== undefined || body.handicap_points_per_rating_gap !== undefined)) {
      return NextResponse.json({ error: "only an admin can change the manager or handicap coefficient" }, { status: 403 });
    }
    await updateTournament(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
