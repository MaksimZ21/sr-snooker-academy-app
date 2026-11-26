import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireUser";
import { signAssessmentToken } from "@/lib/auth/assessment-token";
import { fetchAssessmentById } from "@/lib/sheets/assessments";
import { sendAssessmentReportTemplate } from "@/lib/whatsapp/meta-cloud";

// Sends the report to the participant's own WhatsApp through Meta's approved
// "assessment_report" template. Meta downloads the PDF from a signed link, so
// the link is built from this request's origin (the live site).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireStaff();
    const { id } = await params;
    const assessment = await fetchAssessmentById(id);
    if (!assessment || (user.role === "coach" && assessment.coach_email !== user.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!assessment.participant_phone) {
      return NextResponse.json({ error: "no_phone" }, { status: 400 });
    }

    const token = signAssessmentToken(id);
    const pdfUrl = `${new URL(req.url).origin}/api/assessments/${id}/pdf?token=${token}`;
    await sendAssessmentReportTemplate(
      assessment.participant_phone,
      assessment.participant_name,
      pdfUrl,
      `דוח אבחון - ${assessment.participant_name}.pdf`,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[assessment send-whatsapp]", e);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
