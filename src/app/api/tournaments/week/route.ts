import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentsInRange } from "@/lib/sheets/tournaments";

// Only CRM-created tournaments (the ones with an event_date) ever come
// back here — a manually-created tournament never appears on the
// Schedule. No manager-based filtering, matching GET /api/tournaments:
// any admin or coach sees every tournament.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const tournaments = await fetchTournamentsInRange(start, end);
    return NextResponse.json({ tournaments });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
