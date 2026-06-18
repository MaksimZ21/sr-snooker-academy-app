import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const BUCKET = "whatsapp-media";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `הקובץ גדול מדי (מקסימום ${maxMb}MB)` }, { status: 413 });
    }

    // Create bucket if it doesn't exist (idempotent)
    await db.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
