import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchSessionsForCoachToday,
  fetchSessionsTodayAll,
} from "@/lib/sheets/sessions";

function todayInTel(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

export async function GET() {
  try {
    const user = await requireUser();
    const today = todayInTel();
    const data =
      user.role === "admin"
        ? await fetchSessionsTodayAll(today)
        : await fetchSessionsForCoachToday(user.email, today);
    return NextResponse.json({ sessions: data, today });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
