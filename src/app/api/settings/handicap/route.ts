import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchHandicapDistricts,
  addHandicapDistrict,
  renameHandicapDistrict,
  deleteHandicapDistrict,
  setHandicapValue,
  type HandicapDistrict,
} from "@/lib/sheets/handicap";

function errorResponse(e: unknown) {
  if (e instanceof Response) return e;
  if (e instanceof z.ZodError) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
}

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const districts: HandicapDistrict[] = await fetchHandicapDistricts();
    return NextResponse.json({ districts });
  } catch (e) {
    return errorResponse(e);
  }
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("rename"), id: z.string().min(1), name: z.string().min(1).max(60) }),
  z.object({ action: z.literal("delete"), id: z.string().min(1) }),
  z.object({
    action: z.literal("set"),
    id: z.string().min(1),
    level: z.string().min(1),
    points: z.number().min(0).max(200).nullable(),
  }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = Body.parse(await req.json());
    if (body.action === "add") await addHandicapDistrict(body.name);
    else if (body.action === "rename") await renameHandicapDistrict(body.id, body.name);
    else if (body.action === "delete") await deleteHandicapDistrict(body.id);
    else await setHandicapValue(body.id, body.level, body.points);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
