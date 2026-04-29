import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchSessionsForCoachWeek,
  fetchSessionsAll,
} from "@/lib/sheets/sessions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const coach = req.nextUrl.searchParams.get("coach");
    let data;
    if (user.role === "admin") {
      const all = await fetchSessionsAll();
      data = all.filter(
        (s) =>
          s.date >= start &&
          s.date <= end &&
          (!coach || s.coach_email === coach),
      );
    } else {
      data = await fetchSessionsForCoachWeek(user.email, start, end);
    }
    return NextResponse.json({ sessions: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
