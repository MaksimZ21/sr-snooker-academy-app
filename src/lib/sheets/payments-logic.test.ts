import { describe, expect, it } from "vitest";
import { firstTrainingAfter, nextRenewalDate, paymentStatus, summarizePayments, type PaymentFields } from "./payments-logic";

const base: PaymentFields = { payment_method: "אשראי", payment_amount: 450, next_payment_date: "2026-11-25", payment_frozen: false };
const TODAY = "2026-11-22"; // Sunday
const WEEK_END = "2026-11-28";

describe("paymentStatus", () => {
  it("is overdue once the renewal date has passed", () => {
    expect(paymentStatus({ ...base, next_payment_date: "2026-11-21" }, TODAY, WEEK_END)).toBe("overdue");
  });
  it("is due this week from today through Saturday", () => {
    expect(paymentStatus({ ...base, next_payment_date: TODAY }, TODAY, WEEK_END)).toBe("due_week");
    expect(paymentStatus({ ...base, next_payment_date: WEEK_END }, TODAY, WEEK_END)).toBe("due_week");
  });
  it("is paid when the renewal is after this week", () => {
    expect(paymentStatus({ ...base, next_payment_date: "2026-11-29" }, TODAY, WEEK_END)).toBe("paid");
  });
  it("is missing without a method or a renewal date", () => {
    expect(paymentStatus({ ...base, payment_method: null }, TODAY, WEEK_END)).toBe("missing");
    expect(paymentStatus({ ...base, next_payment_date: null }, TODAY, WEEK_END)).toBe("missing");
  });
  it("frozen wins over everything", () => {
    expect(paymentStatus({ ...base, next_payment_date: "2026-01-01", payment_frozen: true }, TODAY, WEEK_END)).toBe("frozen");
  });
});

describe("nextRenewalDate", () => {
  it("keeps the day of the month even when paid late", () => {
    expect(nextRenewalDate("2026-11-04", "2026-11-22")).toBe("2026-12-04");
  });
  it("crosses the year", () => {
    expect(nextRenewalDate("2026-12-15", "2026-12-15")).toBe("2027-01-15");
  });
  it("clamps to the end of a shorter month", () => {
    expect(nextRenewalDate("2027-01-31", "2027-01-31")).toBe("2027-02-28");
  });
  it("counts from the payment day without a renewal date", () => {
    expect(nextRenewalDate(null, "2026-11-22")).toBe("2026-12-22");
  });
});

describe("summarizePayments", () => {
  it("counts and sums by status and leaves frozen students out of the money", () => {
    const s = summarizePayments(
      [
        { ...base, next_payment_date: "2026-11-04", payment_amount: 400 },
        { ...base, next_payment_date: "2026-11-25", payment_amount: 500 },
        { ...base, next_payment_date: "2026-12-10", payment_amount: 450 },
        { ...base, payment_method: null, payment_amount: null },
        { ...base, payment_frozen: true, payment_amount: 450 },
      ],
      TODAY,
      WEEK_END,
    );
    expect(s.overdue).toEqual({ count: 1, amount: 400 });
    expect(s.dueWeek).toEqual({ count: 1, amount: 500 });
    expect(s.missing).toBe(1);
    expect(s.frozen).toBe(1);
    expect(s.monthly).toBe(1350);
  });
});

describe("firstTrainingAfter", () => {
  // Monday group: 2026-11-16, 11-23, 11-30.
  const mondays = ["2026-11-16", "2026-11-23", "2026-11-30"];
  it("paid on a Tuesday -> the next Monday", () => {
    expect(firstTrainingAfter("2026-11-17", mondays)).toBe("2026-11-23");
  });
  it("paid on the training day itself -> that session", () => {
    expect(firstTrainingAfter("2026-11-23", mondays)).toBe("2026-11-23");
  });
  it("nothing scheduled ahead -> the last session rolled forward by weeks", () => {
    expect(firstTrainingAfter("2026-12-02", mondays)).toBe("2026-12-07");
    expect(firstTrainingAfter("2026-12-07", mondays)).toBe("2026-12-07");
  });
  it("no sessions at all -> null", () => {
    expect(firstTrainingAfter("2026-11-17", [])).toBeNull();
  });
});
