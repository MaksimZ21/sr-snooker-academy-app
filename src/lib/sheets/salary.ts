import { db } from "@/lib/db/client";
import type { CoachSalary, SessionDetail, OffsetEntry } from "@/app/api/admin/salary/route";

// Single-coach, single-month version of the aggregation the admin salary
// dashboard does across all coaches at once (src/app/api/admin/salary/route.ts).
// Reuses that route's types (type-only import — no runtime dependency) so
// there is exactly one definition of what a "coach salary" shape looks
// like. Returns null for a malformed month string; returns a CoachSalary
// with empty arrays/zero totals (never null) when the month is valid but
// the coach simply has no sessions/offsets that month.
export async function fetchCoachSalaryForMonth(
  email: string,
  month: string, // "YYYY-MM"
): Promise<CoachSalary | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [{ data: sessionRows }, { data: coachRow }] = await Promise.all([
    db
      .from("sessions")
      .select("id, source, price_nis, training_type, date, start_time")
      .eq("coach_email", email)
      .neq("status", "cancelled")
      .gte("date", start)
      .lt("date", nextMonth),
    db.from("coaches").select("offsets").eq("email", email).maybeSingle(),
  ]);

  const sessions: SessionDetail[] = (sessionRows ?? [])
    .map((row) => ({
      id: row.id as string,
      date: row.date as string,
      start_time: (row.start_time as string) ?? "",
      source: (row.source as string) || "אחר",
      training_type: (row.training_type as string) || "אחר",
      price_nis: (row.price_nis as number) ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  const bySource = new Map<string, { count: number; total: number }>();
  for (const s of sessions) {
    if (!bySource.has(s.source)) bySource.set(s.source, { count: 0, total: 0 });
    const agg = bySource.get(s.source)!;
    agg.count++;
    agg.total += s.price_nis;
  }
  const rows = Array.from(bySource.entries()).map(([source, agg]) => ({
    source,
    count: agg.count,
    total_nis: agg.total,
  }));

  const amount_total = sessions.reduce((s, r) => s + r.price_nis, 0);
  const allOffsets = (coachRow?.offsets ?? []) as OffsetEntry[];
  const offsets = allOffsets.filter((o) => o.month === month);
  const offsets_total = offsets.reduce((s, o) => s + o.amount, 0);

  return {
    email,
    rows,
    sessions,
    sessions_total: sessions.length,
    amount_total,
    offsets,
    offsets_total,
    net_total: amount_total - offsets_total,
  };
}
