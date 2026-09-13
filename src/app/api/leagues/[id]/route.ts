import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, updateLeague, isLeagueManager } from "@/lib/sheets/leagues";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  manager_email: z.email().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = UpdateSchema.parse(await req.json());
    if (user.role !== "admin" && body.manager_email !== undefined) {
      return NextResponse.json({ error: "only an admin can change the manager" }, { status: 403 });
    }
    if (body.manager_email !== undefined) {
      const activeCoachEmails = await fetchActiveCoachEmails();
      if (!activeCoachEmails.map((e) => e.toLowerCase()).includes(body.manager_email.toLowerCase())) {
        return NextResponse.json({ error: "manager_email must be an active coach" }, { status: 400 });
      }
    }
    await updateLeague(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
