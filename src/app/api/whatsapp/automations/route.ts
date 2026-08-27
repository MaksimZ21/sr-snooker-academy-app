import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type AutomationStep = {
  id: string;
  automation_id: string;
  step_order: number;
  time_of_day: string | null;
  message_type: "text" | "group_settings";
  payload: string;
};

export type Automation = {
  id: string;
  name: string;
  created_at: string;
  steps: AutomationStep[];
};

const StepInput = z.object({
  time_of_day: z.string().nullable(),
  message_type: z.enum(["text", "group_settings"]),
  payload: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [{ data: automations }, { data: steps }] = await Promise.all([
      db.from("whatsapp_automations").select("*").order("name", { ascending: true }),
      db.from("whatsapp_automation_steps").select("*").order("step_order", { ascending: true }),
    ]);
    const stepsByAutomation = new Map<string, AutomationStep[]>();
    for (const step of (steps ?? []) as AutomationStep[]) {
      const list = stepsByAutomation.get(step.automation_id) ?? [];
      list.push(step);
      stepsByAutomation.set(step.automation_id, list);
    }
    const result = ((automations ?? []) as Omit<Automation, "steps">[]).map((a) => ({
      ...a,
      steps: stepsByAutomation.get(a.id) ?? [],
    }));
    return NextResponse.json({ automations: result });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = z
      .object({
        name: z.string().min(1),
        steps: z.array(StepInput).min(1),
      })
      .parse(await req.json());
    const { data: automation } = await db
      .from("whatsapp_automations")
      .insert({ name: body.name })
      .select()
      .single();
    const rows = body.steps.map((s, i) => ({
      automation_id: (automation as { id: string }).id,
      step_order: i + 1,
      time_of_day: s.time_of_day,
      message_type: s.message_type,
      payload: s.payload,
    }));
    await db.from("whatsapp_automation_steps").insert(rows);
    return NextResponse.json({ ok: true, id: (automation as { id: string }).id });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
