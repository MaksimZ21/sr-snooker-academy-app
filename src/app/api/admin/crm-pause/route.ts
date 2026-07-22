import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getCrmPaused, setCrmPaused } from "@/lib/sheets/settings";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const paused = await getCrmPaused();
    return NextResponse.json({ paused });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const current = await getCrmPaused();
    await setCrmPaused(!current);
    return NextResponse.json({ paused: !current });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
