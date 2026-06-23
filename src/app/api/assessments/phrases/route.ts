import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAssessmentPhrases } from "@/lib/sheets/assessment-phrases";

export async function GET() {
  try {
    await requireUser();
    const phrases = await fetchAssessmentPhrases();
    return NextResponse.json({ phrases, _v: 7 });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[assessment-phrases]", msg);
    return NextResponse.json({ phrases: [], error: msg, _v: 7 });
  }
}
