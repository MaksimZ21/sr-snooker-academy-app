"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddPricingDialog() {
  const [open, setOpen] = useState(false);
  const [lessonType, setLessonType] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const reset = () => {
    setLessonType("");
    setDuration("");
    setPrice("");
    setNotes("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lesson_type: lessonType,
          duration_min: Number(duration),
          price_nis: Number(price),
          notes,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { ok: true };
    },
    onSuccess: () => {
      toast.success("השורה נוספה למחירון");
      qc.invalidateQueries({ queryKey: ["pricing"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת שורה"),
  });

  const canSubmit =
    lessonType.trim().length > 0 &&
    duration.trim().length > 0 &&
    !Number.isNaN(Number(duration)) &&
    Number(duration) > 0 &&
    price.trim().length > 0 &&
    !Number.isNaN(Number(price)) &&
    !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף שורה
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף שורה למחירון</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>סוג שיעור</Label>
            <Input
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
            />
          </div>
          <div>
            <Label>משך (דקות)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div>
            <Label>מחיר (₪)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mut.isPending}
          >
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
