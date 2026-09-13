import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { ensurePlayerSlug } from "@/lib/sheets/players";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    await ensurePlayerSlug(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
