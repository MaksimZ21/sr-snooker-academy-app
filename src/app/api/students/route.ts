import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { createOrPromoteStudent, fetchStudents } from "@/lib/sheets/students";
import { SKILL_LEVELS, SKILL_LEVELS_9FT } from "@/lib/sheets/schemas";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const data = await fetchStudents();
    return NextResponse.json({ students: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        college_name: z.string().optional(),
        subscription_type: z.string().optional(),
        general_notes: z.string().optional(),
        birth_date: z.string().nullable().optional(),
        last_payment_date: z.string().nullable().optional(),
        skill_level: z.enum(SKILL_LEVELS).nullable().optional(),
        skill_level_9ft: z.enum(SKILL_LEVELS_9FT).nullable().optional(),
      })
      .parse(await req.json());
    const id = await createOrPromoteStudent(body);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return new NextResponse("error", { status: 500 });
  }
}
