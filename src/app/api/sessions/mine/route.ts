import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionsForCoach, fetchSessionsAll } from "@/lib/sheets/sessions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const coachParam = req.nextUrl.searchParams.get("coach");

    let sessions;
    if (user.role === "admin" && coachParam) {
      const all = await fetchSessionsAll();
      sessions = all
        .filter((s) => s.coach_email === coachParam)
        .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
    } else {
      sessions = await fetchSessionsForCoach(user.email);
    }

    return NextResponse.json({ sessions });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
