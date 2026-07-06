import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAssessmentById } from "@/lib/sheets/assessments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const assessment = await fetchAssessmentById(id);
    if (!assessment) return new NextResponse("not found", { status: 404 });
    if (user.role === "coach" && assessment.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.json({ assessment });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
