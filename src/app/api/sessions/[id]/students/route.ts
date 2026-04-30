import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById, setSessionStudents } from "@/lib/sheets/sessions";
import { fetchStudents } from "@/lib/sheets/students";

const Body = z.object({
  student_ids: z.array(z.string().min(1)),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin")
      return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return new NextResponse("not found", { status: 404 });
    const body = Body.parse(await req.json());
    const allStudents = await fetchStudents();
    const valid = new Set(allStudents.map((s) => s.id));
    const unknown = body.student_ids.filter((sid) => !valid.has(sid));
    if (unknown.length > 0) {
      return new NextResponse(
        JSON.stringify({ error: "unknown student ids", unknown }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    await setSessionStudents(id, body.student_ids);
    return NextResponse.json({ ok: true, student_ids: body.student_ids });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
