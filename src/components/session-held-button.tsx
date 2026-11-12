"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type WithSession = { session: { status: string }; [k: string]: unknown };

// Marks a session as "didn't happen" (status "cancelled") or back again.
export function SessionHeldButton({ sessionId, cancelled }: { sessionId: string; cancelled: boolean }) {
  const qc = useQueryClient();
  const queryKey = ["session", sessionId];

  const setStatus = (status: string) =>
    qc.setQueryData<WithSession>(queryKey, (old) => old && { ...old, session: { ...old.session, status } });

  const mut = useMutation({
    mutationFn: async (held: boolean) => {
      const r = await fetch(`/api/sessions/${sessionId}/held`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ held }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onMutate: async (held) => {
      await qc.cancelQueries({ queryKey });
      setStatus(held ? "scheduled" : "cancelled");
    },
    onSuccess: (_d, held) => {
      toast.success(held ? "האימון סומן כהתקיים" : "האימון סומן כלא התקיים");
      qc.invalidateQueries({ queryKey: ["sessions:week"] });
    },
    onError: () => {
      setStatus(cancelled ? "cancelled" : "scheduled");
      toast.error("לא נשמר, נסה שוב");
    },
  });

  return cancelled ? (
    <Button size="sm" variant="outline" onClick={() => mut.mutate(true)} disabled={mut.isPending} className="gap-1.5">
      <RotateCcw size={14} />
      בטל סימון "לא התקיים"
    </Button>
  ) : (
    <Button
      size="sm"
      variant="outline"
      onClick={() => mut.mutate(false)}
      disabled={mut.isPending}
      className="gap-1.5 text-destructive"
    >
      <CircleOff size={14} />
      לא התקיים
    </Button>
  );
}
