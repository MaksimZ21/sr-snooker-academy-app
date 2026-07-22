import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertStudentFromCrm } from "@/lib/sheets/students";
import { logWebhook } from "@/lib/sheets/webhook-log";

const CrmQuery = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional().default(""),
  phone: z.string().optional(),
  email: z.string().email(),
  college_name: z.string().optional(),
  subscription_type: z.string().optional(),
  birthday: z.string().optional(), // DD/MM/YYYY from CRM
});

// Convert DD/MM/YYYY → YYYY-MM-DD for the DB, or null if unparseable
function parseBirthday(raw?: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

  const parsed = CrmQuery.safeParse(raw);
  if (!parsed.success) {
    void logWebhook({ route: "crm", event_type: "student_upsert", params: raw, status: "invalid", result: parsed.error.flatten() });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await upsertStudentFromCrm({
    ...parsed.data,
    birth_date: parseBirthday(parsed.data.birthday),
  });
  void logWebhook({ route: "crm", event_type: "student_upsert", params: raw, status: "ok", result });
  return NextResponse.json(result, { status: 200 });
}
