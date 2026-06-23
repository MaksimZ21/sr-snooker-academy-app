import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const BUCKET = "assessments";

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `photos/${crypto.randomUUID()}.${ext}`;
    const buf  = Buffer.from(await file.arrayBuffer());

    const { error } = await db.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
