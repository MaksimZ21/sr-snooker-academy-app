import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchContactRequests, markContactRequestRead } from "@/lib/sheets/contact";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const requests = await fetchContactRequests();
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await req.json() as { id: string };
    await markContactRequestRead(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
