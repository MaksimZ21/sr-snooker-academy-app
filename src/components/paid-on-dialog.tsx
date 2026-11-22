"use client";
import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { todayIsoTel } from "@/lib/date";
import type { PaymentBoardRow } from "@/lib/sheets/payments";

const QUICK = [
  { label: "היום", days: 0 },
  { label: "אתמול", days: -1 },
  { label: "שלשום", days: -2 },
] as const;

// "שולם": pick the day the money came in (today by default), then confirm.
export function PaidOnDialog({
  row,
  pending,
  onClose,
  onConfirm,
}: {
  row: PaymentBoardRow | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: (paidOnIso: string) => void;
}) {
  const today = todayIsoTel();
  const [date, setDate] = useState(today);

  useEffect(() => {
    if (row) setDate(todayIsoTel());
  }, [row]);

  const shift = (days: number) => format(addDays(parseISO(today), days), "yyyy-MM-dd");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <Dialog open={row !== null} onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>תאריך התשלום · {row?.first_name} {row?.last_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            {QUICK.map((q) => {
              const iso = shift(q.days);
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDate(iso)}
                  className={cn(
                    "flex-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    date === iso ? "border-primary bg-primary text-white" : "bg-background hover:bg-muted",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
          <p className="text-xs text-muted-foreground">
            תאריך החידוש יתקדם בחודש, והאימון הראשון יחושב מהתאריך הזה.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
          <Button onClick={() => onConfirm(date)} disabled={!valid || pending}>
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            אישור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
