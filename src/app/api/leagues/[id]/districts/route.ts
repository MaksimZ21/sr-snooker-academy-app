import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, canManageLeagues } from "@/lib/sheets/leagues";
import { fetchLeagueDistricts, addLeagueDistrict } from "@/lib/sheets/league-districts";

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
    const districts = await fetchLeagueDistricts(id);
    return NextResponse.json({ districts });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const AddDistrictSchema = z.object({
  label: z.string().min(1),
  numCycles: z.number().int().positive().optional(),
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
    const { label, numCycles } = AddDistrictSchema.parse(await req.json());
    const district = await addLeagueDistrict(id, label, numCycles ?? 1);
    return NextResponse.json({ district });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
