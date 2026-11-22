import { db } from "@/lib/db/client";
import { todayIsoTel, weekRangeFor } from "@/lib/date";
import { sendPaymentsSummaryTemplate } from "@/lib/whatsapp/meta-cloud";
import { fetchPaymentBoard } from "./payments";
import { summarizePayments } from "./payments-logic";

const PHONE_KEY = "payments_summary_phone";

// The number the Sunday summary goes to (settings table). No number, no message.
export async function getPaymentsSummaryPhone(): Promise<string | null> {
  const { data } = await db.from("settings").select("value").eq("key", PHONE_KEY).maybeSingle();
  const phone = (data?.value as string | undefined)?.trim();
  return phone ? phone : null;
}

function israelDayAndHour(now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return {
    day: parts.find((p) => p.type === "weekday")?.value ?? "",
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
  };
}

// Builds this week's numbers and sends the template to the given phone.
export async function sendPaymentsSummary(phone: string): Promise<void> {
  const today = todayIsoTel();
  const { startIso, endIso } = weekRangeFor(today);
  const s = summarizePayments(await fetchPaymentBoard(), today, endIso);
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  await sendPaymentsSummaryTemplate(phone, {
    week: `${ddmm(startIso)}–${ddmm(endIso)}`,
    overdue: s.overdue.count,
    due: s.dueWeek.count,
    amount: s.overdue.amount + s.dueWeek.amount,
  });
}

// Called from the WhatsApp cron (every few minutes). Sends once a week, on
// Sunday from 9:00 Israel time; the week is claimed in settings first so
// overlapping cron runs never send twice.
export async function sendWeeklyPaymentsSummaryIfDue(now = new Date()): Promise<"sent" | "skipped"> {
  const { day, hour } = israelDayAndHour(now);
  if (day !== "Sun" || hour < 9) return "skipped";
  const phone = await getPaymentsSummaryPhone();
  if (!phone) return "skipped";

  const weekStart = weekRangeFor(todayIsoTel()).startIso;
  const { error: claimError } = await db
    .from("settings")
    .insert({ key: `payments_summary_sent:${weekStart}`, value: now.toISOString() });
  if (claimError) return "skipped"; // already claimed this week

  await sendPaymentsSummary(phone);
  return "sent";
}
