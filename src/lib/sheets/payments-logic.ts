import { addMonths, format, parseISO } from "date-fns";

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
