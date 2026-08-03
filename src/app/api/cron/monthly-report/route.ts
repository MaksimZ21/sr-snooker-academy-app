import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";
import type { OffsetEntry } from "@/app/api/admin/salary/route";

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

function currentMonthRange(): { monthKey: string; start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const start = `${monthKey}-01`;
  const nextMonth = m === 11
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 2).padStart(2, "0")}-01`;
  return { monthKey, start, end: nextMonth, label: `${HEBREW_MONTHS[m]} ${y}` };
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const { monthKey, start, end, label } = currentMonthRange();

  const [{ data: coaches }, { data: sessions }] = await Promise.all([
    db.from("coaches").select("email, name, phone, offsets").eq("active", true),
    db.from("sessions")
      .select("coach_email, price_nis")
      .neq("status", "cancelled")
      .gte("date", start)
      .lt("date", end),
  ]);

  const results: { email: string; status: "sent" | "skipped" | "error"; reason?: string }[] = [];

  for (const coach of coaches ?? []) {
    const email = coach.email as string;
    const name = coach.name as string;
    const phone = coach.phone as string;

    if (!phone) {
      results.push({ email, status: "skipped", reason: "no phone" });
      continue;
    }

    const coachSessions = (sessions ?? []).filter(
      (s) => (s.coach_email as string) === email,
    );

    if (coachSessions.length === 0) {
      results.push({ email, status: "skipped", reason: "no sessions" });
      continue;
    }

    const gross = coachSessions.reduce((s, r) => s + ((r.price_nis as number) ?? 0), 0);
    const allOffsets = (coach.offsets ?? []) as OffsetEntry[];
    const monthOffsets = allOffsets.filter((o) => o.month === monthKey);
    const offsetsTotal = monthOffsets.reduce((s, o) => s + o.amount, 0);
    const net = gross - offsetsTotal;

    const lines = [
      `📊 דוח חודשי – ${label}`,
      ``,
      `שלום ${name},`,
      `הנה סיכום ${label}:`,
      ``,
      `🗓 אימונים: ${coachSessions.length}`,
      `💰 הכנסה גולמית: ${gross.toLocaleString("he-IL")} ₪`,
    ];

    if (offsetsTotal > 0) {
      lines.push(`➖ קיזוזים: ${offsetsTotal.toLocaleString("he-IL")} ₪`);
    }

    lines.push(`✅ לתשלום: ${net.toLocaleString("he-IL")} ₪`);
    lines.push(``);
    lines.push(`אקדמיית סנוקר`);

    try {
      await sendWhatsAppMessage(phone, lines.join("\n"));
      results.push({ email, status: "sent" });
    } catch (e) {
      results.push({ email, status: "error", reason: String(e) });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ ok: true, month: label, sent, results });
}
