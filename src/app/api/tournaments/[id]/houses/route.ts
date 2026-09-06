import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentHouses, hasAnyHouseResult } from "@/lib/sheets/tournament-houses";

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
    const [houses, hasAnyResult] = await Promise.all([fetchTournamentHouses(id), hasAnyHouseResult(id)]);
    return NextResponse.json({ houses, hasAnyResult });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
