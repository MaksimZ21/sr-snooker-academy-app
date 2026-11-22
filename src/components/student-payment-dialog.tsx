"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  EMPTY_PAYMENT,
  PaymentFieldsEditor,
  paymentDraftFrom,
  paymentDraftInvalid,
  paymentDraftToBody,
  type PaymentDraft,
} from "@/components/forms/payment-fields-editor";
import type { PaymentBoardRow } from "@/lib/sheets/payments";

// Edits one student's payment details from the finance tab.
export function StudentPaymentDialog({ row, onClose }: { row: PaymentBoardRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT);

  useEffect(() => {
    if (row) setDraft(paymentDraftFrom(row));
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const r = await fetch(`/api/admin/payments/students/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(paymentDraftToBody(draft)),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("פרטי התשלום נשמרו");
      qc.invalidateQueries({ queryKey: ["payments:board"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            פרטי תשלום · {row?.first_name} {row?.last_name}
          </DialogTitle>
        </DialogHeader>
        <PaymentFieldsEditor value={draft} onChange={setDraft} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || paymentDraftInvalid(draft)}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            שמור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
