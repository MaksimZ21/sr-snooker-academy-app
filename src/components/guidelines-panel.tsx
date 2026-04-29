"use client";
import { useQuery } from "@tanstack/react-query";
import type { Guideline } from "@/lib/sheets/schemas";

export function GuidelinesPanel({ trainingType }: { trainingType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guidelines"],
    queryFn: async () => {
      const r = await fetch("/api/guidelines");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { guidelines: Guideline[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const filtered = (data?.guidelines ?? []).filter(
    (g) => !g.training_type || g.training_type === trainingType,
  );
  if (filtered.length === 0)
    return <div className="p-4 text-muted-foreground">אין הנחיות לסוג אימון זה</div>;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {filtered
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <div key={g.id} className="border rounded p-3">
            <div className="text-xs text-muted-foreground">{g.category}</div>
            <h3 className="font-semibold">{g.title}</h3>
            {g.body_or_link.startsWith("http") ? (
              <a href={g.body_or_link} target="_blank" rel="noopener" className="text-primary underline text-sm">
                פתח קישור
              </a>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{g.body_or_link}</p>
            )}
          </div>
        ))}
    </div>
  );
}
