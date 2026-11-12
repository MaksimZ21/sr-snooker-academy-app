import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireUser";
import { fetchSessionById, updateSession } from "@/lib/sheets/sessions";

type HeldResponse = { ok: true } | { error: string };

const PutSchema = z.object({ held: z.boolean() });

// "Didn't happen" toggle: an admin, or the session's own coach.
// Not held = status "cancelled" (shown as "לא התקיים", left out of pay).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff();
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return NextResponse.json<HeldResponse>({ error: "not found" }, { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return NextResponse.json<HeldResponse>({ error: "Forbidden" }, { status: 403 });
    }
    const { held } = PutSchema.parse(await req.json());
    await updateSession(id, { status: held ? "scheduled" : "cancelled" });
    return NextResponse.json<HeldResponse>({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return NextResponse.json<HeldResponse>({ error: "bad request" }, { status: 400 });
    return NextResponse.json<HeldResponse>({ error: "internal error" }, { status: 500 });
  }
}
