"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Coach = { email: string; name: string; active: boolean };

export function CoachSelector({
  sessionId,
  currentCoachEmail,
}: {
  sessionId: string;
  currentCoachEmail: string;
}) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
  });

  const mut = useMutation({
    mutationFn: async (coachEmail: string) => {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coach_email: coachEmail }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("המאמן עודכן");
    },
    onError: () => toast.error("שגיאה בשמירת המאמן"),
  });

  const coaches = (data?.coaches ?? []).filter((c) => c.active);
  const value = currentCoachEmail || "__none__";

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/60 text-xs">מאמן</span>
      <Select
        value={value}
        onValueChange={(v) => mut.mutate(v === "__none__" ? "" : v)}
        disabled={mut.isPending}
      >
        <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-8 w-44">
          <SelectValue placeholder="לא משובץ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">לא משובץ</SelectItem>
          {coaches.map((c) => (
            <SelectItem key={c.email} value={c.email}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
