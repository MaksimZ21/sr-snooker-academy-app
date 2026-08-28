import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchAssessments, createAssessment } from "@/lib/sheets/assessments";

const TechniqueSchema = z.record(z.string(), z.enum(["good", "medium", "bad"]));

const CreateSchema = z.object({
  participant_name: z.string().min(1),
  participant_phone: z.string().optional().default(""),
  event_date: z.string().min(1),
  strong_hand: z.enum(["right", "left"]).optional(),
  strong_eye: z.enum(["right", "left"]).optional(),
  technique: TechniqueSchema.default({}),
  notes: z.string().optional().default(""),
  photo_url: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const list = await fetchAssessments(user.role === "coach" ? user.email : undefined);
    return NextResponse.json({ assessments: list });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role === "denied") return new NextResponse("Forbidden", { status: 403 });

    const body = CreateSchema.parse(await req.json());
    const assessment = await createAssessment({
      coach_email: user.email,
      participant_name: body.participant_name,
      participant_phone: body.participant_phone || null,
      event_date: body.event_date,
      strong_hand: body.strong_hand ?? null,
      strong_eye: body.strong_eye ?? null,
      technique: body.technique,
      notes: body.notes || null,
      photo_url: body.photo_url ?? null,
    });
    return NextResponse.json({ assessment }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
