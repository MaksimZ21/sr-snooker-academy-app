"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Coach = { email: string; name: string; phone: string; active: boolean };

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

  if (isLoading) return <div className="p-4">טוען...</div>;
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        עריכת רשימת המאמנים נעשית ישירות ב-Google Sheets.
      </p>
      {(data?.coaches ?? []).map((c) => (
        <Card key={c.email}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.email}</div>
              {c.phone && <div className="text-sm">{c.phone}</div>}
            </div>
            <Badge variant={c.active ? "default" : "secondary"}>
              {c.active ? "פעיל" : "לא פעיל"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
