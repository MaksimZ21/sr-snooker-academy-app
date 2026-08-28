import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { runId } = await params;
    const { error } = await db
      .from("whatsapp_scheduled")
      .delete()
      .eq("automation_run_id", runId)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
