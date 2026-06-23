import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type SalaryRow = {
  source: string;
  count: number;
  total_nis: number;
};

export type SessionDetail = {
  id: string;
  date: string;
  source: string;
  training_type: string;
  price_nis: number;
};

export type CoachSalary = {
  email: string;
  rows: SalaryRow[];
  sessions: SessionDetail[];
  sessions_total: number;
  amount_total: number;
};

export type SalaryResponse = {
  period: string;
  coaches: CoachSalary[];
  grand_total: number;
  session_count: number;
  coach_count: number;
  by_source: { source: string; total: number }[];
  by_training_type: { type: string; total: number }[];
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
    const year  = req.nextUrl.searchParams.get("year");  // YYYY

    let query = db
      .from("sessions")
      .select("id, coach_email, source, price_nis, training_type, date")
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
    const sessionsPerCoach = new Map<string, SessionDetail[]>();
    const srcMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};

    for (const row of data ?? []) {
      const email   = row.coach_email as string;
      const source  = (row.source as string) || "אחר";
      const type    = (row.training_type as string) || "אחר";
      const price   = (row.price_nis as number) ?? 0;

      // Per coach aggregate
      if (!map.has(email)) map.set(email, new Map());
      const inner = map.get(email)!;
      if (!inner.has(source)) inner.set(source, { count: 0, total: 0 });
      const agg = inner.get(source)!;
      agg.count++;
      agg.total += price;

      // Per coach session detail
      if (!sessionsPerCoach.has(email)) sessionsPerCoach.set(email, []);
      sessionsPerCoach.get(email)!.push({
        id: row.id as string,
        date: row.date as string,
        source,
        training_type: type,
        price_nis: price,
      });

      // Global by source
      srcMap[source] = (srcMap[source] ?? 0) + price;

      // Global by training type
      typeMap[type] = (typeMap[type] ?? 0) + price;
    }

    const coaches: CoachSalary[] = Array.from(map.entries()).map(([email, sourceMap]) => {
      const rows: SalaryRow[] = Array.from(sourceMap.entries()).map(([source, agg]) => ({
        source,
        count: agg.count,
        total_nis: agg.total,
      }));
      const sessions = (sessionsPerCoach.get(email) ?? []).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      return {
        email,
        rows,
        sessions,
        sessions_total: rows.reduce((s, r) => s + r.count, 0),
        amount_total:   rows.reduce((s, r) => s + r.total_nis, 0),
      };
    });

    const grand_total = coaches.reduce((s, c) => s + c.amount_total, 0);
    const session_count = (data ?? []).length;
    const coach_count = map.size;

    const by_source = Object.entries(srcMap)
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total);

    const by_training_type = Object.entries(typeMap)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      period: periodLabel,
      coaches,
      grand_total,
      session_count,
      coach_count,
      by_source,
      by_training_type,
    } satisfies SalaryResponse);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
