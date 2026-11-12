import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, canManageLeagues } from "@/lib/sheets/leagues";
import { fetchLevelTracking, applyLevelChange, type LeagueLevelRow } from "@/lib/sheets/league-levels";

type GetResponse = { rows: LeagueLevelRow[] } | { error: string };
type PostResponse = { ok: true; level: string } | { error: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json<GetResponse>({ error: "not found" }, { status: 404 });
    const tracking = await fetchLevelTracking(detail.participants.map((p) => p.student_id));
    const rows = detail.participants.map((p) => tracking[p.student_id]).filter((r): r is LeagueLevelRow => !!r);
    return NextResponse.json<GetResponse>({ rows });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json<GetResponse>({ error: "internal error" }, { status: 500 });
  }
}

const PostSchema = z.object({ studentId: z.string().min(1) });

// Admin approves a level change for a player who is a candidate.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff();
    if (!canManageLeagues(user)) return NextResponse.json<PostResponse>({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json<PostResponse>({ error: "not found" }, { status: 404 });
    const { studentId } = PostSchema.parse(await req.json());
    if (!detail.participants.some((p) => p.student_id === studentId)) {
      return NextResponse.json<PostResponse>({ error: "not in this league" }, { status: 404 });
    }
    const level = await applyLevelChange(studentId);
    return NextResponse.json<PostResponse>({ ok: true, level });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return NextResponse.json<PostResponse>({ error: "bad request" }, { status: 400 });
    if (e instanceof Error) return NextResponse.json<PostResponse>({ error: e.message }, { status: 400 });
    return NextResponse.json<PostResponse>({ error: "internal error" }, { status: 500 });
  }
}
