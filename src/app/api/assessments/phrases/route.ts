import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAssessmentPhrases } from "@/lib/sheets/assessment-phrases";

const getCached = unstable_cache(fetchAssessmentPhrases, ["assessment-phrases"], { revalidate: 3600 });

export async function GET() {
  try {
    await requireUser();
    const phrases = await getCached();
    return NextResponse.json({ phrases });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[assessment-phrases]", msg);
    return NextResponse.json({ phrases: [], error: msg });
  }
}
