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
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddCoachDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const qc = useQueryClient();

  const reset = () => {
    setEmail("");
    setName("");
    setPhone("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/coaches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, phone }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { email: string };
    },
    onSuccess: () => {
      toast.success("המאמן נוסף בהצלחה");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת המאמן"),
  });

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = isValidEmail && name.trim().length > 0 && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף מאמן
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף מאמן</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>אימייל</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>שם</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>טלפון</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
