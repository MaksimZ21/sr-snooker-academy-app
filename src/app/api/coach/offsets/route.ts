import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";
import type { OffsetEntry } from "@/app/api/admin/salary/route";

export async function GET() {
  try {
    const user = await requireUser();
    const { data } = await db
      .from("coaches")
      .select("offsets")
      .eq("email", user.email)
      .maybeSingle();
    const offsets = (data?.offsets ?? []) as OffsetEntry[];
    return NextResponse.json({ offsets });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
