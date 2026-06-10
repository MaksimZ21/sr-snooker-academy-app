import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchSessionsForCoachWeek,
  fetchSessionsForDateRange,
} from "@/lib/sheets/sessions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const coach = req.nextUrl.searchParams.get("coach");
    let data;
    if (user.role === "admin") {
      data = await fetchSessionsForDateRange(start, end, coach ?? undefined);
    } else {
      data = await fetchSessionsForCoachWeek(user.email, start, end);
    }
    return NextResponse.json({ sessions: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
