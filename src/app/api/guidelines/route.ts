import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { appendGuideline, fetchGuidelines } from "@/lib/sheets/guidelines";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchGuidelines();
    return NextResponse.json({ guidelines: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        category: z.string().min(1),
        order: z.coerce.number().int(),
        training_type: z.string().optional(),
        title: z.string().min(1),
        body_or_link: z.string().min(1),
      })
      .parse(await req.json());
    const id = await appendGuideline(body);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
