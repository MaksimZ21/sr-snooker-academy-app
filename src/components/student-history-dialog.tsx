"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trainingTypeBadge } from "@/lib/training-type";
import type { Session } from "@/lib/sheets/schemas";

type Row = { session: Session; attendance_status: "present" | "absent" | "late" };

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "לא נוכח",
  late: "איחור",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function StudentHistoryDialog({ studentId, studentName, open, onOpenChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-sessions", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}/sessions`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Row[] };
    },
    enabled: open,
    staleTime: 2 * 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>היסטוריית נוכחות — {studentName}</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}
        {!isLoading && data?.sessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            לא נמצאו שיעורים עם נוכחות מסומנת
          </p>
        )}
        {!isLoading && (data?.sessions ?? []).length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {(data?.sessions ?? []).map((row) => {
              const type = trainingTypeBadge(row.session.training_type);
              return (
                <div
                  key={row.session.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium">{formatDate(row.session.date)}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.session.start_time}–{row.session.end_time}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={type.className}>
                      {type.label}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[row.attendance_status]}>
                      {STATUS_LABEL[row.attendance_status]}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
