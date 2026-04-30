"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddStudentDialog } from "@/components/forms/add-student-dialog";
import type { Student } from "@/lib/sheets/schemas";

export function StudentsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
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
        <p className="text-sm text-muted-foreground">ניהול רשימת המתאמנים</p>
        <AddStudentDialog />
      </div>
      {(data?.students ?? []).map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="font-semibold">
                {s.name}{" "}
                <span className="text-xs text-muted-foreground">({s.id})</span>
              </div>
              {s.phone && (
                <div className="text-sm text-muted-foreground">{s.phone}</div>
              )}
              {(s.parent_name || s.parent_phone) && (
                <div className="text-sm">
                  הורה: {s.parent_name}
                  {s.parent_phone ? ` · ${s.parent_phone}` : ""}
                </div>
              )}
              {s.general_notes && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                  {s.general_notes}
                </div>
              )}
            </div>
            <Badge variant={s.active ? "default" : "secondary"}>
              {s.active ? "פעיל" : "לא פעיל"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
