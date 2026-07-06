import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { sendWhatsAppMessage, sendWhatsAppFile } from "@/lib/whatsapp/greenapi";

const Body = z.union([
  z.object({
    phone: z.string().min(1),
    message: z.string().min(1),
    urlFile: z.undefined(),
  }),
  z.object({
    phone: z.string().min(1),
    urlFile: z.string().min(1),
    fileName: z.string().optional(),
    caption: z.string().optional(),
    message: z.undefined(),
  }),
]);

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());
    if (body.urlFile) {
      await sendWhatsAppFile(body.phone, body.urlFile, body.caption ?? "", body.fileName);
    } else {
      await sendWhatsAppMessage(body.phone, body.message!);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
