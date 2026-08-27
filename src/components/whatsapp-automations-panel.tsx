"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, ListChecks } from "lucide-react";
import { CreateAutomationDialog, EditAutomationDialog } from "@/components/whatsapp-automation-form";
import { RunAutomationDialog } from "@/components/whatsapp-automation-run-dialog";
import type { Automation } from "@/app/api/whatsapp/automations/route";

export function WhatsAppAutomationsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp:automations"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/automations");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { automations: Automation[] };
    },
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/automations/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("אוטומציה נמחקה");
      qc.invalidateQueries({ queryKey: ["whatsapp:automations"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const automations = data?.automations ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateAutomationDialog />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : automations.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          אין אוטומציות עדיין
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {automations.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-border/60 bg-card p-4 flex items-center justify-between gap-3 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ListChecks size={15} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.steps.length} שלבים</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <RunAutomationDialog automation={a} />
                <EditAutomationDialog automation={a} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
