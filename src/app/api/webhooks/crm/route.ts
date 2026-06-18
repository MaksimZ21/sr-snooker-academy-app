import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertStudentFromCrm } from "@/lib/sheets/students";

const CrmQuery = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().email(),
  college_name: z.string().optional(),
  subscription_type: z.string().optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

  const parsed = CrmQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await upsertStudentFromCrm(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
