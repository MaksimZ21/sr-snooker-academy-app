import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { appendSessionPricingRule, fetchSessionPricingRules } from "@/lib/sheets/session-pricing";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const rules = await fetchSessionPricingRules();
    return NextResponse.json({ rules });
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
        label: z.string().min(1),
        price_nis: z.coerce.number().int().nonnegative(),
      })
      .parse(await req.json());
    await appendSessionPricingRule(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
