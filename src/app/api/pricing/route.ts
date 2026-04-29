import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchPricing } from "@/lib/sheets/pricing";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchPricing();
    return NextResponse.json({ pricing: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
