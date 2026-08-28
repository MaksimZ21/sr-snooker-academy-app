import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { fetchGoalForMonth, upsertGoalEntry, monthOf } from "@/lib/sheets/monthly-goals";

const EntrySchema = z.union([
  z.object({ successCount: z.number().int().nonnegative(), attemptCount: z.number().int().positive() }),
  z.object({ bestBreak: z.number().int().nonnegative() }),
]);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, studentId } = await params;
    const session = await fetchSessionById(id);
    if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!session.student_ids.includes(studentId)) {
      return new NextResponse("student not in session", { status: 400 });
    }

    const goal = await fetchGoalForMonth(studentId, monthOf(session.date));
    if (!goal) return NextResponse.json({ error: "no goal this month" }, { status: 400 });

    const body = EntrySchema.parse(await req.json());
    if (goal.category === "breaks" && !("bestBreak" in body)) {
      return NextResponse.json({ error: "expected bestBreak for this category" }, { status: 400 });
    }
    if (goal.category !== "breaks" && !("successCount" in body)) {
      return NextResponse.json({ error: "expected successCount/attemptCount for this category" }, { status: 400 });
    }

    await upsertGoalEntry(id, goal.id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
