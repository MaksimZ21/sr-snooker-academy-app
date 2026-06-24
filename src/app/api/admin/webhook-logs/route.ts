import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const route  = searchParams.get("route")  ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit  = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

    let query = db
      .from("webhook_logs")
      .select("id, route, event_type, params, status, result, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (route)  query = query.eq("route", route);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ logs: [], error: String(e) }, { status: 500 });
  }
}
