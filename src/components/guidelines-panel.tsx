"use client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  const filtered = (data?.guidelines ?? []).filter(
    (g) => !g.training_type || g.training_type === trainingType,
  );
  if (filtered.length === 0)
    return (
      <div className="mt-4 p-6 text-center text-sm text-muted-foreground/60 border border-dashed rounded-xl">
        אין הנחיות לסוג אימון זה
      </div>
    );

  return (
    <div className="flex flex-col gap-3 mt-4">
      {filtered
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <div
            key={g.id}
            className="border border-border/60 rounded-xl p-4 flex flex-col gap-2 bg-card hover:bg-muted/20 transition-colors"
          >
            {g.category && (
              <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full self-start">
                {g.category}
              </span>
            )}
            <h3 className="font-semibold text-sm">{g.title}</h3>
            {g.body_or_link.startsWith("http") ? (
              <a
                href={g.body_or_link}
                target="_blank"
                rel="noopener"
                className="text-primary text-sm inline-flex items-center gap-1.5 hover:underline underline-offset-2 font-medium"
              >
                פתח קישור
                <ExternalLink size={13} />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {g.body_or_link}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
