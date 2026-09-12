import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { updateStudent } from "@/lib/sheets/students";

const PatchBody = z.object({
  rating: z.coerce.number().int(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    await updateStudent(id, { rating: body.rating });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
