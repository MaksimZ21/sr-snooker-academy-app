import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";

const Body = z.object({
  phone: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const { phone, message } = Body.parse(await req.json());
    await sendWhatsAppMessage(phone, message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
