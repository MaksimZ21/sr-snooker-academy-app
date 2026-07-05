import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { updateGroup, deleteGroup } from "@/lib/sheets/groups";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const { name, student_ids, college_name, coach_email, start_time } = await req.json();
    if (!name?.trim()) return new NextResponse("missing name", { status: 400 });
    await updateGroup(id, name.trim(), student_ids ?? [], college_name?.trim() || undefined, coach_email?.trim() || undefined, start_time?.trim() || undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    await deleteGroup(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
