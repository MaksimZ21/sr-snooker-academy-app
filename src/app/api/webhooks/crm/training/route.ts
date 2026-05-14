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
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());

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
  });

  return NextResponse.json(result, { status: 200 });
}
