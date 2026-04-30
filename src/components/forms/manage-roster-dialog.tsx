"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users } from "lucide-react";

type Student = {
  id: string;
  name: string;
  phone?: string;
  active: boolean;
};

export function ManageRosterDialog({
  sessionId,
  currentStudentIds,
}: {
  sessionId: string;
  currentStudentIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(currentStudentIds),
  );
  const qc = useQueryClient();

  function onOpenChange(o: boolean) {
    if (o) setSelected(new Set(currentStudentIds));
    setOpen(o);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    enabled: open,
    staleTime: 60_000,
  });

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}/students`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_ids: Array.from(selected) }),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onSuccess: () => {
      toast.success("נשמר");
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions:today"] });
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
      setOpen(false);
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const activeStudents = (data?.students ?? []).filter((s) => s.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Users className="ml-2 h-4 w-4" />
        ניהול מתאמנים ({currentStudentIds.length})
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ניהול מתאמנים</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-4 text-muted-foreground">טוען...</div>
        ) : (
          <div className="max-h-72 overflow-y-auto flex flex-col gap-2 border rounded p-3">
            {activeStudents.length === 0 && (
              <div className="text-sm text-muted-foreground">
                אין מתאמנים פעילים. הוסף מתאמן קודם.
              </div>
            )}
            {activeStudents.map((s) => {
              const checked = selected.has(s.id);
              return (
                <Label
                  key={s.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) next.add(s.id);
                      else next.delete(s.id);
                      setSelected(next);
                    }}
                  />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.id}</span>
                </Label>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mut.isPending}
          >
            ביטול
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
