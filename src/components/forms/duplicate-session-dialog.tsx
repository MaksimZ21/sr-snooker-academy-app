"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { Session } from "@/lib/sheets/schemas";

export function DuplicateSessionDialog({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          start_time: session.start_time,
          end_time: session.end_time,
          coach_email: session.coach_email,
          training_type: session.training_type,
          student_ids: session.student_ids,
          drive_folder_url: session.drive_folder_url || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { id: string };
    },
    onSuccess: ({ id }) => {
      toast.success(`שוכפל מפגש ${id}`);
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
      qc.invalidateQueries({ queryKey: ["sessions:today"] });
      setOpen(false);
      setDate("");
    },
    onError: () => toast.error("שגיאה בשכפול"),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/15 rounded-lg"
        onClick={() => setOpen(true)}
        title="שכפל מפגש"
      >
        <Copy size={14} />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDate(""); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>שכפל מפגש</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            בחר תאריך — כל שאר הפרטים יועתקו מהמפגש הנוכחי.
          </p>
          <div>
            <Label>תאריך חדש</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mut.isPending}
            >
              ביטול
            </Button>
            <Button
              onClick={() => mut.mutate()}
              disabled={!date || mut.isPending}
            >
              {mut.isPending ? "מעתיק..." : "שכפל"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
