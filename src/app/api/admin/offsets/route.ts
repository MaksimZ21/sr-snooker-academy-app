import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";
import { revalidateTag } from "next/cache";
import type { OffsetEntry } from "@/app/api/admin/salary/route";

const PostBody = z.object({
  coach_email: z.string().min(1),
  amount: z.number(),
  description: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

const DeleteBody = z.object({
  coach_email: z.string().min(1),
  id: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const { coach_email, amount, description, month } = PostBody.parse(await req.json());

    const { data } = await db.from("coaches").select("offsets").eq("email", coach_email).single();
    const current = (data?.offsets ?? []) as OffsetEntry[];
    const entry: OffsetEntry = { id: crypto.randomUUID(), amount, description, month };

    await db.from("coaches").update({ offsets: [...current, entry] }).eq("email", coach_email);
    revalidateTag("coaches", { expire: 0 });

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const { coach_email, id } = DeleteBody.parse(await req.json());

    const { data } = await db.from("coaches").select("offsets").eq("email", coach_email).single();
    const updated = ((data?.offsets ?? []) as OffsetEntry[]).filter((o) => o.id !== id);

    await db.from("coaches").update({ offsets: updated }).eq("email", coach_email);
    revalidateTag("coaches", { expire: 0 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
