import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionsForCoach } from "@/lib/sheets/sessions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const coachParam = req.nextUrl.searchParams.get("coach");

    const email = user.role === "admin" && coachParam ? coachParam : user.email;
    const sessions = await fetchSessionsForCoach(email);

    return NextResponse.json({ sessions });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
