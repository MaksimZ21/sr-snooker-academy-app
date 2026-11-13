import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { TABLE_SIZES } from "@/lib/sheets/schemas";
import {
  fetchSkillLevelEntries,
  addSkillLevel,
  renameSkillLevel,
  deleteSkillLevel,
  moveSkillLevel,
  type SkillLevelEntry,
} from "@/lib/sheets/skill-levels";

function errorResponse(e: unknown) {
  if (e instanceof Response) return e;
  if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
}

// Any signed-in staff member can read the lists (forms use them); only an
// admin can change them.
export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "denied") return new NextResponse("Forbidden", { status: 403 });
    const entries: SkillLevelEntry[] = await fetchSkillLevelEntries();
    return NextResponse.json({ entries });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), tableSize: z.enum(TABLE_SIZES), label: z.string().min(1).max(10) }),
  z.object({ action: z.literal("rename"), id: z.string().min(1), label: z.string().min(1).max(10) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
  z.object({ action: z.literal("move"), id: z.string().min(1), direction: z.enum(["up", "down"]) }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = Body.parse(await req.json());
    if (body.action === "add") await addSkillLevel(body.tableSize, body.label);
    else if (body.action === "rename") await renameSkillLevel(body.id, body.label);
    else if (body.action === "delete") await deleteSkillLevel(body.id);
    else await moveSkillLevel(body.id, body.direction);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
