"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Guideline } from "@/lib/sheets/schemas";

export function GuidelinesLibrary() {
  const [q, setQ] = useState("");
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
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded" />
        ))}
      </div>
    );
  }
  const filtered = (data?.guidelines ?? [])
    .filter((g) => g.title.includes(q) || g.category.includes(q))
    .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
  const grouped: Record<string, Guideline[]> = {};
  filtered.forEach((g) => {
    grouped[g.category] = grouped[g.category] ?? [];
    grouped[g.category].push(g);
  });

  return (
    <div className="p-4 flex flex-col gap-4">
      <Input placeholder="חיפוש..." value={q} onChange={(e) => setQ(e.target.value)} />
      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <h2 className="font-bold mb-2">{cat}</h2>
          <div className="flex flex-col gap-2">
            {items.map((g) => (
              <div key={g.id} className="border rounded p-3">
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
        </section>
      ))}
    </div>
  );
}
