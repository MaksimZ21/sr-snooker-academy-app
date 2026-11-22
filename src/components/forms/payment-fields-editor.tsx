"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/sheets/payments-logic";

// The payment section of a student, as edited in the student form and in the
// finance tab. Dates are "" when empty, amount is the raw text.
export type PaymentDraft = {
  method: string;
  amount: string;
  lastDate: string;
  nextDate: string;
  firstDate: string;
  notes: string;
  frozen: boolean;
};

type PaymentSource = {
  payment_method?: string | null;
  payment_amount?: number | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  first_training_date?: string | null;
  payment_notes?: string | null;
  payment_frozen?: boolean | null;
};

export const EMPTY_PAYMENT: PaymentDraft = {
  method: "",
  amount: "",
  lastDate: "",
  nextDate: "",
  firstDate: "",
  notes: "",
  frozen: false,
};

export function paymentDraftFrom(s: PaymentSource): PaymentDraft {
  return {
    method: s.payment_method ?? "",
    amount: s.payment_amount === null || s.payment_amount === undefined ? "" : String(s.payment_amount),
    lastDate: s.last_payment_date ?? "",
    nextDate: s.next_payment_date ?? "",
    firstDate: s.first_training_date ?? "",
    notes: s.payment_notes ?? "",
    frozen: s.payment_frozen ?? false,
  };
}

export function paymentDraftToBody(d: PaymentDraft) {
  return {
    payment_method: d.method || null,
    payment_amount: d.amount.trim() === "" ? null : Math.round(Number(d.amount)),
    last_payment_date: d.lastDate || null,
    next_payment_date: d.nextDate || null,
    first_training_date: d.firstDate || null,
    payment_notes: d.notes.trim(),
    payment_frozen: d.frozen,
  };
}

export function paymentDraftInvalid(d: PaymentDraft): boolean {
  return d.amount.trim() !== "" && !(Number(d.amount) >= 0);
}

export function PaymentFieldsEditor({
  value,
  onChange,
  legacySubscription,
}: {
  value: PaymentDraft;
  onChange: (d: PaymentDraft) => void;
  // The CRM's free-text subscription type, shown for reference only.
  legacySubscription?: string;
}) {
  const set = <K extends keyof PaymentDraft>(k: K, v: PaymentDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>צורת תשלום</Label>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set("method", value.method === m ? "" : m)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                value.method === m ? "border-primary bg-primary text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {legacySubscription && <p className="text-[11px] text-muted-foreground">סוג מנוי מה-CRM: {legacySubscription}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-amount">סכום חודשי (₪)</Label>
        <Input id="pay-amount" inputMode="numeric" value={value.amount} onChange={(e) => set("amount", e.target.value)} placeholder="450" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-last">תשלום אחרון</Label>
          <Input id="pay-last" type="date" value={value.lastDate} onChange={(e) => set("lastDate", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-next">תאריך חידוש</Label>
          <Input id="pay-next" type="date" value={value.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-first">אימון ראשון</Label>
          <Input id="pay-first" type="date" value={value.firstDate} onChange={(e) => set("firstDate", e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-notes">הערות תשלום</Label>
        <Textarea id="pay-notes" value={value.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16 resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={value.frozen}
          onChange={(e) => set("frozen", e.target.checked)}
          className="h-4 w-4 accent-sky-500"
        />
        מוקפא (לא נכנס לסיכום התשלומים)
      </label>
    </div>
  );
}
