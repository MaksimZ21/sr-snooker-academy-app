import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { undoPayment } from "@/lib/sheets/payments";

// Undoes a "שולם" press: the student's dates go back to what they were.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    await undoPayment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[payments DELETE]", e);
    return new NextResponse("error", { status: 500 });
  }
}
