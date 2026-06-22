import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type SalaryRow = {
  source: string;
  count: number;
  total_nis: number;
};

export type CoachSalary = {
  email: string;
  rows: SalaryRow[];
  sessions_total: number;
  amount_total: number;
};

export type SalaryResponse = {
  period: string;
  coaches: CoachSalary[];
  grand_total: number;
  by_source: { source: string; total: number }[];
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
    const year  = req.nextUrl.searchParams.get("year");  // YYYY

    let query = db
      .from("sessions")
      .select("coach_email, source, price_nis")
      .eq("status", "completed")
      .neq("coach_email", "");

    let periodLabel = "כל הזמן";

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      query = query.gte("date", start).lt("date", nextMonth);
      periodLabel = month;
    } else if (year && /^\d{4}$/.test(year)) {
      query = query.gte("date", `${year}-01-01`).lt("date", `${Number(year) + 1}-01-01`);
      periodLabel = year;
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregate by coach + source
    const map = new Map<string, Map<string, { count: number; total: number }>>();
    for (const row of data ?? []) {
      const email  = row.coach_email as string;
      const source = (row.source as string) || "אחר";
      const price  = (row.price_nis as number) ?? 0;
      if (!map.has(email)) map.set(email, new Map());
      const inner = map.get(email)!;
      if (!inner.has(source)) inner.set(source, { count: 0, total: 0 });
      const agg = inner.get(source)!;
      agg.count++;
      agg.total += price;
    }

    const coaches: CoachSalary[] = Array.from(map.entries()).map(([email, sourceMap]) => {
      const rows: SalaryRow[] = Array.from(sourceMap.entries()).map(([source, agg]) => ({
        source,
        count: agg.count,
        total_nis: agg.total,
      }));
      return {
        email,
        rows,
        sessions_total: rows.reduce((s, r) => s + r.count, 0),
        amount_total:   rows.reduce((s, r) => s + r.total_nis, 0),
      };
    });

    const grand_total = coaches.reduce((s, c) => s + c.amount_total, 0);

    // Global breakdown by source
    const srcMap: Record<string, number> = {};
    for (const c of coaches) for (const r of c.rows) srcMap[r.source] = (srcMap[r.source] ?? 0) + r.total_nis;
    const by_source = Object.entries(srcMap)
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ period: periodLabel, coaches, grand_total, by_source } satisfies SalaryResponse);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
