import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchIntroEvents } from "@/lib/sheets/intro-events";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const events = await fetchIntroEvents();
    return NextResponse.json({ events });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
