import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { searchStudents } from "@/lib/sheets/tournaments";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const students = await searchStudents(q);
    return NextResponse.json({ students });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
