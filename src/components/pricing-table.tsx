"use client";
import { useQuery } from "@tanstack/react-query";
import type { Pricing } from "@/lib/sheets/schemas";

export function PricingTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const r = await fetch("/api/pricing");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { pricing: Pricing[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const rows = data?.pricing ?? [];

  return (
    <div className="p-4">
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
