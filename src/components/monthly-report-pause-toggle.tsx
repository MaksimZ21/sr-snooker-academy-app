"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Pauses the monthly WhatsApp report cron (src/app/api/cron/monthly-report)
// that sends every coach their sessions/pay summary at month's end —
// mirrors the exact same settings-table pause pattern already used for
// the CRM pause toggle in webhook-logs-viewer.tsx.
export function MonthlyReportPauseToggle() {
  const qc = useQueryClient();

  const pauseQ = useQuery({
    queryKey: ["monthly-report-paused"],
    queryFn: async () => {
      const r = await fetch("/api/admin/monthly-report-pause");
      return (await r.json()) as { paused: boolean };
    },
  });

  const toggleMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/monthly-report-pause", { method: "POST" });
      return (await r.json()) as { paused: boolean };
    },
    onSuccess: (result) => {
      qc.setQueryData(["monthly-report-paused"], result);
      toast.success(result.paused ? "הדוח החודשי מושהה" : "הדוח החודשי פעיל מחדש");
    },
    onError: () => toast.error("שגיאה בשינוי הסטטוס"),
  });

  const paused = pauseQ.data?.paused ?? false;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5",
        paused
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-border/60 bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        {paused
          ? <PauseCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          : <PlayCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
        <div>
          <p className="text-sm font-medium">
            {paused ? "הדוח החודשי מושהה" : "הדוח החודשי פעיל"}
          </p>
          <p className="text-xs text-muted-foreground">
            {paused
              ? "לא יישלח דוח סיכום חודשי למאמנים בוואטסאפ"
              : "בסוף החודש יישלח לכל מאמן סיכום אימונים ותשלום"}
          </p>
        </div>
      </div>
      <Button
        variant={paused ? "default" : "outline"}
        size="sm"
        onClick={() => toggleMut.mutate()}
        disabled={toggleMut.isPending || pauseQ.isLoading}
      >
        {paused ? "הפעל מחדש" : "השהה"}
      </Button>
    </div>
  );
}
