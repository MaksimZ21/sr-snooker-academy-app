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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { TRAINING_TYPE_LABEL } from "@/lib/training-type";

const TRAINING_TYPES = [
  "private",
  "group",
  "beginners",
  "advanced",
  "technique",
  "match-play",
] as const;

const ALL_TYPES_VALUE = "__all__";

export function AddGuidelineDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState("");
  const [trainingType, setTrainingType] = useState<string>(ALL_TYPES_VALUE);
  const [title, setTitle] = useState("");
  const [bodyOrLink, setBodyOrLink] = useState("");
  const qc = useQueryClient();

  const reset = () => {
    setCategory("");
    setOrder("");
    setTrainingType(ALL_TYPES_VALUE);
    setTitle("");
    setBodyOrLink("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/guidelines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          order: Number(order),
          training_type:
            trainingType === ALL_TYPES_VALUE ? "" : trainingType,
          title,
          body_or_link: bodyOrLink,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { id: string };
    },
    onSuccess: ({ id }) => {
      toast.success(`נוספה הנחיה ${id}`);
      qc.invalidateQueries({ queryKey: ["guidelines"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת הנחיה"),
  });

  const canSubmit =
    category.trim().length > 0 &&
    order.trim().length > 0 &&
    !Number.isNaN(Number(order)) &&
    title.trim().length > 0 &&
    bodyOrLink.trim().length > 0 &&
    !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף הנחיה
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף הנחיה</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>קטגוריה</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <Label>סדר</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
          <div>
            <Label>סוג אימון</Label>
            <Select
              value={trainingType}
              onValueChange={(v) => setTrainingType(v ?? ALL_TYPES_VALUE)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="כל סוגי האימונים" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES_VALUE}>
                  כל סוגי האימונים
                </SelectItem>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRAINING_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>כותרת</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>תוכן / קישור</Label>
            <Textarea
              value={bodyOrLink}
              onChange={(e) => setBodyOrLink(e.target.value)}
              placeholder="טקסט חופשי או URL"
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
