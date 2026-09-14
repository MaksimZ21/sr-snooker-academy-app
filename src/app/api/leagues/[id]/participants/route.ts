import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, addLeagueParticipant, canManageLeagues } from "@/lib/sheets/leagues";

const AddSchema = z
  .object({
    studentId: z.string().min(1).optional(),
    newStudentName: z.string().min(1).optional(),
  })
  .refine((v) => v.studentId || v.newStudentName, { message: "studentId or newStudentName required" });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canManageLeagues(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = AddSchema.parse(await req.json());
    const participant = await addLeagueParticipant(id, body);
    return NextResponse.json({ participant });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
