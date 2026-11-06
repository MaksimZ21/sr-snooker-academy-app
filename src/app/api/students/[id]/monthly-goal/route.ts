import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchStudentGoals, createMonthlyGoal } from "@/lib/sheets/monthly-goals";
import { getStudentByEmail } from "@/lib/sheets/students";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (user.role === "student") {
      const self = await getStudentByEmail(user.email);
      if (!self || self.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const goals = await fetchStudentGoals(id);
    return NextResponse.json({ goals });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  category: z.enum(["technique", "angle", "cue_ball_control", "breaks"]),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (user.role === "student") {
      const self = await getStudentByEmail(user.email);
      if (!self || self.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { category, month } = CreateSchema.parse(await req.json());
    // Staff working in an older session set the goal for that session's month;
    // a student only ever picks for the current one.
    const goal = await createMonthlyGoal(id, category, user.role === "student" ? undefined : month);
    return NextResponse.json({ goal });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message === "כבר נבחרה מטרה החודש") {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
