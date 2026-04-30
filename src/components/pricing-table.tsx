"use client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pricing } from "@/lib/sheets/schemas";
import { AddPricingDialog } from "@/components/forms/add-pricing-dialog";

export function PricingTable({ showAdd = false }: { showAdd?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const r = await fetch("/api/pricing");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { pricing: Pricing[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }
  const rows = data?.pricing ?? [];

  return (
    <div className="p-4 flex flex-col gap-3">
      {showAdd && (
        <div className="flex justify-end">
          <AddPricingDialog />
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-right p-2">סוג שיעור</th>
            <th className="text-right p-2">משך</th>
            <th className="text-right p-2">מחיר (₪)</th>
            <th className="text-right p-2">הערות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{p.lesson_type}</td>
              <td className="p-2">{p.duration_min} דקות</td>
              <td className="p-2">{p.price_nis}</td>
              <td className="p-2 text-sm text-muted-foreground">{p.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
