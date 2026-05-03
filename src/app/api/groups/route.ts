import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGroupsAll, appendGroup } from "@/lib/sheets/groups";

export async function GET() {
  try {
    await requireUser();
    const groups = await fetchGroupsAll();
    return NextResponse.json({ groups });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { name, student_ids } = await req.json();
    if (!name?.trim()) return new NextResponse("missing name", { status: 400 });
    const id = await appendGroup(name.trim(), student_ids ?? []);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
