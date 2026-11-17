import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchIntroEventsInRange } from "@/lib/sheets/intro-events";

// The admin sees every intro event in range; a coach sees only the ones
// the admin assigned to them (coach_email).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const events = await fetchIntroEventsInRange(start, end, user.role === "coach" ? user.email : undefined);
    return NextResponse.json({ events });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
