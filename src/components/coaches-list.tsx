"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone } from "lucide-react";
import { AddCoachDialog } from "@/components/forms/add-coach-dialog";

type Coach = { email: string; name: string; phone: string; active: boolean };

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CoachesList() {
  const { data, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">ניהול רשימת המאמנים</p>
        <AddCoachDialog />
      </div>
      {(data?.coaches ?? []).map((c) => (
        <Card key={c.email} className="hover:shadow-sm transition-shadow">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center text-sm font-bold shrink-0 select-none shadow-md ring-2 ring-primary/20">
                {getInitials(c.name)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-sm text-muted-foreground truncate">{c.email}</div>
                {c.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone size={11} />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>
            <Badge
              variant={c.active ? "default" : "secondary"}
              className="shrink-0"
            >
              {c.active ? "פעיל" : "לא פעיל"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
