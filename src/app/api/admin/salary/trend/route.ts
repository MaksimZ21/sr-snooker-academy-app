import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

export type TrendMonth = { month: string; label: string; shortLabel: string; total: number };
export type TrendResponse = { months: TrendMonth[] };

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const now = new Date();
    // Start of current month, then go back 11 more months = 12 total
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const startStr = startDate.toISOString().slice(0, 10);
    const endStr   = endDate.toISOString().slice(0, 10);

    const { data, error } = await db
      .from("sessions")
      .select("date, price_nis")
      .eq("status", "completed")
      .neq("coach_email", "")
      .gte("date", startStr)
      .lt("date", endStr);

    if (error) throw error;

    // Aggregate by YYYY-MM
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      const month = (row.date as string).slice(0, 7);
      map[month] = (map[month] ?? 0) + ((row.price_nis as number) ?? 0);
    }

    const months: TrendMonth[] = [];
    for (let i = 0; i < 12; i++) {
      const d   = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        month:      key,
        label:      `${HEBREW_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        shortLabel: HEBREW_MONTHS[d.getMonth()].slice(0, 3),
        total:      map[key] ?? 0,
      });
    }

    return NextResponse.json({ months } satisfies TrendResponse);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
