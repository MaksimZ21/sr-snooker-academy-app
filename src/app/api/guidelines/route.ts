import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGuidelines } from "@/lib/sheets/guidelines";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchGuidelines();
    return NextResponse.json({ guidelines: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
