"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddStudentDialog } from "@/components/forms/add-student-dialog";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import { History } from "lucide-react";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

export function StudentsList() {
  const [selected, setSelected] = useState<Student | null>(null);

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
                {studentFullName(s)}{" "}
                <span className="text-xs text-muted-foreground">({s.id})</span>
              </div>
              {s.phone && (
                <div className="text-sm text-muted-foreground">{s.phone}</div>
              )}
              {s.college_name && (
                <div className="text-sm text-muted-foreground">{s.college_name}</div>
              )}
              {s.general_notes && (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                  {s.general_notes}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge variant={s.active ? "default" : "secondary"}>
                {s.active ? "פעיל" : "לא פעיל"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelected(s)}
              >
                <History className="h-3.5 w-3.5 ml-1" />
                נוכחות
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {selected && (
        <StudentHistoryDialog
          studentId={selected.id}
          studentName={studentFullName(selected)}
          open={true}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
    </div>
  );
}
