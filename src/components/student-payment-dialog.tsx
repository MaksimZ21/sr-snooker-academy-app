"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/sheets/payments-logic";
import type { PaymentBoardRow } from "@/lib/sheets/payments";

// Edits one student's payment details (method, amount, dates, notes, frozen).
export function StudentPaymentDialog({ row, onClose }: { row: PaymentBoardRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [notes, setNotes] = useState("");
  const [frozen, setFrozen] = useState(false);

  useEffect(() => {
    if (!row) return;
    setMethod(row.payment_method ?? "");
    setAmount(row.payment_amount === null ? "" : String(row.payment_amount));
    setLastDate(row.last_payment_date ?? "");
    setNextDate(row.next_payment_date ?? "");
    setNotes(row.payment_notes);
    setFrozen(row.payment_frozen);
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const r = await fetch(`/api/admin/payments/students/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payment_method: method || null,
          payment_amount: amount.trim() === "" ? null : Math.round(Number(amount)),
          last_payment_date: lastDate || null,
          next_payment_date: nextDate || null,
          payment_notes: notes.trim(),
          payment_frozen: frozen,
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("פרטי התשלום נשמרו");
      qc.invalidateQueries({ queryKey: ["payments:board"] });
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const amountInvalid = amount.trim() !== "" && !(Number(amount) >= 0);

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            פרטי תשלום · {row?.first_name} {row?.last_name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>צורת תשלום</Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(method === m ? "" : m)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    method === m ? "border-primary bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-amount">סכום חודשי (₪)</Label>
            <Input id="pay-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="450" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-last">תשלום אחרון</Label>
              <Input id="pay-last" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-next">תאריך חידוש</Label>
              <Input id="pay-next" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay-notes">הערות</Label>
            <Textarea id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} className="h-4 w-4 accent-sky-500" />
            מוקפא (לא נכנס לסיכום התשלומים)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              ביטול
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || amountInvalid}>
              {save.isPending && <Loader2 size={14} className="animate-spin" />}
              שמור
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
