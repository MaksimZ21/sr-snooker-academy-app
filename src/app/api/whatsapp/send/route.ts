import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { sendWhatsAppMessage, sendWhatsAppFileByUpload } from "@/lib/whatsapp/greenapi";

const Body = z.object({
  phone: z.string().min(1),
  message: z.string().optional(),
  urlFile: z.string().optional(),
  fileName: z.string().optional(),
  caption: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = Body.parse(await req.json());

    if (body.urlFile) {
      // Download the file server-side so Green API doesn't need to access our auth-protected URL
      const fileRes = await fetch(body.urlFile);
      if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`);
      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const mimeType = fileRes.headers.get("content-type") ?? "application/octet-stream";
      const fileName = body.fileName ?? "file.pdf";
      await sendWhatsAppFileByUpload(body.phone, fileBuffer, fileName, mimeType, body.caption ?? "");
    } else if (body.message) {
      await sendWhatsAppMessage(body.phone, body.message);
    } else {
      return NextResponse.json({ ok: false, error: "message or urlFile required" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
