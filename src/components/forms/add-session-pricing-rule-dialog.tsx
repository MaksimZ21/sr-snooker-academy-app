"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddSessionPricingRuleDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const qc = useQueryClient();

  const reset = () => {
    setLabel("");
    setPrice("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/session-pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          price_nis: Number(price),
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { ok: true };
    },
    onSuccess: () => {
      toast.success("הכלל נוסף");
      qc.invalidateQueries({ queryKey: ["session-pricing"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת הכלל"),
  });

  const canSubmit =
    label.trim().length > 0 &&
    price.trim().length > 0 &&
    !Number.isNaN(Number(price)) &&
    !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף כלל
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף כלל תמחור</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>מילת מפתח (בשם האימון)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='לדוג׳: "מכללה"' />
          </div>
          <div>
            <Label>מחיר (₪)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mut.isPending}>
            ביטול
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
