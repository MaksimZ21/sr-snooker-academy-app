import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchPlayers } from "@/lib/sheets/players";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const players = await fetchPlayers();
    return NextResponse.json({ players });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
