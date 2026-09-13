import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { addLocationHouse } from "@/lib/sheets/tournament-houses";

const AddSchema = z.object({ label: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, locationId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { label } = AddSchema.parse(await req.json());
    const house = await addLocationHouse(id, locationId, label);
    return NextResponse.json({ house });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
