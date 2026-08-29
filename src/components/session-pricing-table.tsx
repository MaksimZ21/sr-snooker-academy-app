"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionPricingRule } from "@/lib/sheets/session-pricing-shared";
import { AddSessionPricingRuleDialog } from "@/components/forms/add-session-pricing-rule-dialog";

export function SessionPricingTable() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["session-pricing"],
    queryFn: async () => {
      const r = await fetch("/api/session-pricing");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { rules: SessionPricingRule[] };
    },
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/session-pricing/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הכלל נמחק");
      qc.invalidateQueries({ queryKey: ["session-pricing"] });
    },
    onError: () => toast.error("שגיאה במחיקת הכלל"),
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        שגיאה בטעינת הכללים
      </div>
    );
  }

  const rows = data?.rules ?? [];

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex justify-end">
        <AddSessionPricingRuleDialog />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-right p-2">מילת מפתח</th>
            <th className="text-right p-2">מחיר (₪)</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-sm text-muted-foreground">
                אין עדיין כללים
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.label}</td>
                <td className="p-2">{r.price_nis}</td>
                <td className="p-2 text-left">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(r.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
