import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchIntroEventsInRange } from "@/lib/sheets/intro-events";

// Any admin or coach sees every intro event in range — no coach-based
// filtering, matching GET /api/tournaments/week (there's no per-event
// manager concept here either, just the coach_email an admin assigns
// after the fact).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const events = await fetchIntroEventsInRange(start, end);
    return NextResponse.json({ events });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
