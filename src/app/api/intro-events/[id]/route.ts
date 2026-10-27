import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchIntroEventDetail, updateIntroEventCoach, canManageIntroEvents } from "@/lib/sheets/intro-events";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const detail = await fetchIntroEventDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  coach_email: z.email().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchIntroEventDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canManageIntroEvents(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { coach_email } = UpdateSchema.parse(await req.json());
    if (coach_email !== null) {
      const activeCoachEmails = await fetchActiveCoachEmails();
      if (!activeCoachEmails.map((e) => e.toLowerCase()).includes(coach_email.toLowerCase())) {
        return NextResponse.json({ error: "coach_email must be an active coach" }, { status: 400 });
      }
    }
    await updateIntroEventCoach(id, coach_email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
