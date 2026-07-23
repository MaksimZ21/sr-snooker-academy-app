import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { sendLoginInvite } from "@/lib/auth/invite";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { email } = z.object({ email: z.email() }).parse(await req.json());
    const origin = new URL(req.url).origin;
    await sendLoginInvite(email, origin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return new NextResponse(msg, { status: 500 });
  }
}
