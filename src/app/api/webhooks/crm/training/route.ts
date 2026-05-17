import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertSessionFromCrm } from "@/lib/sheets/sessions";

const TrainingQuery = z.object({
  event_id: z.string().min(1),
  date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  address: z.string().optional(),
  training_type: z.string().optional(),
  event_type: z.string().optional(),
});

async function handle(raw: Record<string, unknown>) {
  const parsed = TrainingQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const result = await upsertSessionFromCrm({
    crm_event_id: parsed.data.event_id,
    date: parsed.data.date,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    address: parsed.data.address,
    training_type: parsed.data.training_type,
    crm_event_type: parsed.data.event_type,
  });
  return NextResponse.json(result, { status: 200 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return handle(Object.fromEntries(searchParams.entries()));
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await req.json();
  } else {
    const { searchParams } = new URL(req.url);
    body = Object.fromEntries(searchParams.entries());
  }
  return handle(body);
}
