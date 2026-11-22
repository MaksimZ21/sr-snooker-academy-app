import { addDays, addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";

// The ways a student pays, as written in the academy's payments sheet.
// Every method renews monthly (the 3-month standing order charges monthly too).
export const PAYMENT_METHODS = [
  "הוק לשלושה חודשים",
  "אשראי",
  "ביט לשחר בפרטי",
  "העברה בנקאית",
  "מזומן",
] as const;

export type PaymentStatus = "frozen" | "missing" | "overdue" | "due_week" | "paid";

export type PaymentFields = {
  payment_method: string | null;
  payment_amount: number | null;
  next_payment_date: string | null;
  payment_frozen: boolean;
};

// overdue: the renewal date has passed. due_week: it falls between today and
// the end of this week (Saturday). missing: no method or no renewal date.
export function paymentStatus(p: PaymentFields, todayIso: string, weekEndIso: string): PaymentStatus {
  if (p.payment_frozen) return "frozen";
  if (!p.payment_method || !p.next_payment_date) return "missing";
  if (p.next_payment_date < todayIso) return "overdue";
  if (p.next_payment_date <= weekEndIso) return "due_week";
  return "paid";
}

// After a payment the next renewal is a month after the one it covered, so the
// day of the month stays put even when someone pays late. Without a renewal
// date on file, a month from the payment day.
export function nextRenewalDate(coveredIso: string | null, paidOnIso: string): string {
  return format(addMonths(parseISO(coveredIso ?? paidOnIso), 1), "yyyy-MM-dd");
}

export type PaymentSummary = {
  overdue: { count: number; amount: number };
  dueWeek: { count: number; amount: number };
  missing: number;
  frozen: number;
  // What everyone not frozen pays in a month.
  monthly: number;
};

export function summarizePayments(rows: PaymentFields[], todayIso: string, weekEndIso: string): PaymentSummary {
  const s: PaymentSummary = { overdue: { count: 0, amount: 0 }, dueWeek: { count: 0, amount: 0 }, missing: 0, frozen: 0, monthly: 0 };
  for (const r of rows) {
    const status = paymentStatus(r, todayIso, weekEndIso);
    const amount = r.payment_amount ?? 0;
    if (status === "frozen") {
      s.frozen++;
      continue;
    }
    s.monthly += amount;
    if (status === "overdue") {
      s.overdue.count++;
      s.overdue.amount += amount;
    } else if (status === "due_week") {
      s.dueWeek.count++;
      s.dueWeek.amount += amount;
    } else if (status === "missing") {
      s.missing++;
    }
  }
  return s;
}

// The weekly summary as a WhatsApp message (copied or shared by hand):
// who is late and who renews this week, by name, plus the money expected.
export type SummaryRow = PaymentFields & { first_name: string; last_name: string };

export function buildPaymentsSummaryText(
  rows: SummaryRow[],
  todayIso: string,
  weekStartIso: string,
  weekEndIso: string,
): string {
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const nis = (n: number) => `₪${n.toLocaleString("he-IL")}`;
  const pick = (status: PaymentStatus) =>
    rows
      .filter((r) => paymentStatus(r, todayIso, weekEndIso) === status)
      .sort((a, b) => (a.next_payment_date ?? "").localeCompare(b.next_payment_date ?? ""));
  const line = (r: SummaryRow) =>
    [
      `• ${[r.first_name, r.last_name].filter(Boolean).join(" ")}`,
      r.next_payment_date ? dm(r.next_payment_date) : null,
      r.payment_amount ? nis(r.payment_amount) : null,
      r.payment_method,
    ]
      .filter(Boolean)
      .join(" – ");
  const sum = (list: SummaryRow[]) => list.reduce((n, r) => n + (r.payment_amount ?? 0), 0);

  const overdue = pick("overdue");
  const due = pick("due_week");
  const parts = [`*סיכום תשלומים לשבוע ${dm(weekStartIso)}–${dm(weekEndIso)}*`];
  parts.push("", `*באיחור (${overdue.length}):*`, ...(overdue.length ? overdue.map(line) : ["אין"]));
  parts.push("", `*לתשלום השבוע (${due.length}):*`, ...(due.length ? due.map(line) : ["אין"]));
  parts.push("", `צפוי להיכנס: *${nis(sum(overdue) + sum(due))}*`);
  return parts.join("\n");
}

// The first training after a payment: the group's earliest session on or after
// the payment day (paying on a training day counts that session). With no
// session scheduled yet, the group's last session rolled forward a week at a
// time. null when the student has no sessions at all.
export function firstTrainingAfter(paidOnIso: string, sessionDates: string[]): string | null {
  const sorted = [...sessionDates].sort();
  const upcoming = sorted.find((d) => d >= paidOnIso);
  if (upcoming) return upcoming;
  const last = sorted.at(-1);
  if (!last) return null;
  const weeks = Math.ceil(differenceInCalendarDays(parseISO(paidOnIso), parseISO(last)) / 7);
  return format(addDays(parseISO(last), weeks * 7), "yyyy-MM-dd");
}
