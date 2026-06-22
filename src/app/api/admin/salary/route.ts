import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type SalaryRow = {
  coach_email: string;
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
  month: string;
  coaches: CoachSalary[];
  grand_total: number;
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "invalid month" }, { status: 400 });
    }

    const start = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

    const { data, error } = await db
      .from("sessions")
      .select("coach_email, source, price_nis")
      .gte("date", start)
      .lt("date", nextMonth)
      .eq("status", "completed")
      .neq("coach_email", "");

    if (error) throw error;

    // Aggregate by coach + source
    const map = new Map<string, Map<string, { count: number; total: number }>>();
    for (const row of data ?? []) {
      const email = row.coach_email as string;
      const source = (row.source as string) || "אחר";
      const price = (row.price_nis as number) ?? 0;

      if (!map.has(email)) map.set(email, new Map());
      const inner = map.get(email)!;
      if (!inner.has(source)) inner.set(source, { count: 0, total: 0 });
      const agg = inner.get(source)!;
      agg.count++;
      agg.total += price;
    }

    const coaches: CoachSalary[] = Array.from(map.entries())
      .map(([email, sourceMap]) => {
        const rows: SalaryRow[] = Array.from(sourceMap.entries()).map(([source, agg]) => ({
          coach_email: email,
          source,
          count: agg.count,
          total_nis: agg.total,
        }));
        const sessions_total = rows.reduce((s, r) => s + r.count, 0);
        const amount_total = rows.reduce((s, r) => s + r.total_nis, 0);
        return { email, rows, sessions_total, amount_total };
      })
      .sort((a, b) => b.amount_total - a.amount_total);

    const grand_total = coaches.reduce((s, c) => s + c.amount_total, 0);

    return NextResponse.json({ month, coaches, grand_total } satisfies SalaryResponse);
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
