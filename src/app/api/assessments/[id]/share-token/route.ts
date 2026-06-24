import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { signAssessmentToken } from "@/lib/auth/assessment-token";
import { fetchAssessmentById } from "@/lib/sheets/assessments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (user.role === "coach") {
      const assessment = await fetchAssessmentById(id);
      if (!assessment || assessment.coach_email !== user.email) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const token = signAssessmentToken(id);
    return NextResponse.json({ token });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
