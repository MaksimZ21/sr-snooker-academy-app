import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, requireUser } from "@/lib/auth/requireUser";
import { fetchAssessmentById, studentCanSeeAssessment, updateAssessment } from "@/lib/sheets/assessments";

const UpdateSchema = z.object({
  participant_name: z.string().trim().min(1),
  participant_phone: z.string().optional().default(""),
  event_date: z.string().min(1),
  strong_hand: z.enum(["right", "left"]).nullable().optional(),
  strong_eye: z.enum(["right", "left"]).nullable().optional(),
  technique: z.record(z.string(), z.enum(["good", "medium", "bad"])).default({}),
  notes: z.string().optional().default(""),
  photo_url: z.string().nullable().optional(),
});

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
    if (user.role === "student" && !(await studentCanSeeAssessment(user.email, assessment))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return NextResponse.json({ assessment });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

// Edit a saved report (e.g. add the phone that was missing). A coach can
// edit only their own reports.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireStaff();
    const { id } = await params;
    const existing = await fetchAssessmentById(id);
    if (!existing || (user.role === "coach" && existing.coach_email !== user.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = UpdateSchema.parse(await req.json());
    const assessment = await updateAssessment(id, {
      participant_name: body.participant_name,
      participant_phone: body.participant_phone.trim() || null,
      event_date: body.event_date,
      strong_hand: body.strong_hand ?? null,
      strong_eye: body.strong_eye ?? null,
      technique: body.technique,
      notes: body.notes.trim() || null,
      photo_url: body.photo_url ?? null,
    });
    return NextResponse.json({ assessment });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid" }, { status: 400 });
    console.error("[assessment update]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
