import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getWhatsAppGroups } from "@/lib/whatsapp/greenapi";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "denied") return new NextResponse("Forbidden", { status: 403 });
    const groups = await getWhatsAppGroups();
    return NextResponse.json({ groups });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) {
      const cause = e.cause instanceof Error ? e.cause.message : e.cause;
      return NextResponse.json({ error: e.message, cause }, { status: 502 });
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
