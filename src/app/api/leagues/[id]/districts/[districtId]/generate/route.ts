import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, isLeagueManager } from "@/lib/sheets/leagues";
import { generateDistrictFixtures } from "@/lib/sheets/league-districts";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; districtId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, districtId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await generateDistrictFixtures(id, districtId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
