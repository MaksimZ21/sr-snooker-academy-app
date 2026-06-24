import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth/requireUser";
import { verifyAssessmentToken } from "@/lib/auth/assessment-token";
import { fetchAssessmentById } from "@/lib/sheets/assessments";
import { AssessmentPdfDocument } from "@/components/assessment-pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get("token");

    if (token) {
      // Public share link — validate signed token only
      if (!verifyAssessmentToken(token, id)) {
        return new NextResponse("Link expired or invalid", { status: 401 });
      }
    } else {
      // Authenticated access — must be logged in
      const user = await requireUser();
      if (user.role === "coach") {
        // Ownership check — fetch first so we can compare emails
        const assessment = await fetchAssessmentById(id);
        if (!assessment) return new NextResponse("Not found", { status: 404 });
        if (assessment.coach_email !== user.email) {
          return new NextResponse("Forbidden", { status: 403 });
        }
        const buffer = await renderToBuffer(<AssessmentPdfDocument assessment={assessment} />);
        return pdfResponse(buffer, assessment.participant_name);
      }
      // admin falls through to the shared fetch below
    }

    const assessment = await fetchAssessmentById(id);
    if (!assessment) return new NextResponse("Not found", { status: 404 });

    const buffer = await renderToBuffer(<AssessmentPdfDocument assessment={assessment} />);
    return pdfResponse(buffer, assessment.participant_name);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[assessment pdf]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

function pdfResponse(buffer: Buffer, participantName: string) {
  const name = encodeURIComponent(`${participantName} - דוח אבחון`);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${name}.pdf`,
    },
  });
}
