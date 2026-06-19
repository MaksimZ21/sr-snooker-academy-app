import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAssessmentById } from "@/lib/sheets/assessments";
import { AssessmentPdfDocument } from "@/components/assessment-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const assessment = await fetchAssessmentById(id);
    if (!assessment) return new NextResponse("Not found", { status: 404 });
    if (user.role === "coach" && assessment.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const buffer = await renderToBuffer(
      <AssessmentPdfDocument assessment={assessment} />,
    );

    const name = encodeURIComponent(assessment.participant_name);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${name}-assessment.pdf`,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[assessment pdf]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
