import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { appendSession } from "@/lib/sheets/sessions";

const TrainingType = z.enum([
  "private",
  "group",
  "beginners",
  "advanced",
  "technique",
  "match-play",
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().min(1),
        end_time: z.string().min(1),
        coach_email: z.email(),
        training_type: TrainingType,
        student_ids: z.array(z.string().min(1)).min(1),
        drive_folder_url: z.string().optional(),
      })
      .parse(await req.json());
    const id = await appendSession(body);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
