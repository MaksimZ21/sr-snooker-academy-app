import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const StepInput = z.object({
  time_of_day: z.string().nullable(),
  message_type: z.enum(["text", "group_settings"]),
  payload: z.string().min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = z
      .object({
        name: z.string().min(1),
        steps: z.array(StepInput).min(1),
      })
      .parse(await req.json());
    const { error: nameError } = await db
      .from("whatsapp_automations")
      .update({ name: body.name })
      .eq("id", id);
    if (nameError) {
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    const { error: deleteError } = await db
      .from("whatsapp_automation_steps")
      .delete()
      .eq("automation_id", id);
    if (deleteError) {
      // Don't insert the new steps on top of an unconfirmed delete — that
      // could leave old and new steps mixed together under the same
      // automation_id while still reporting success.
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    const rows = body.steps.map((s, i) => ({
      automation_id: id,
      step_order: i + 1,
      time_of_day: s.time_of_day,
      message_type: s.message_type,
      payload: s.payload,
    }));
    const { error: stepsError } = await db.from("whatsapp_automation_steps").insert(rows);
    if (stepsError) {
      // Old steps are already gone (deleted above) and the new ones failed
      // to save — surface this as a failure rather than silently leaving
      // the automation with zero steps. No transactions in this app, so
      // there's no way to roll back the delete; the client gets a clear
      // error instead of a false "updated" success.
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    await db.from("whatsapp_automations").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
