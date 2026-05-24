"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock3, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Attendance, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const STATUSES = [
  {
    key: "present" as const,
    label: "נוכח",
    icon: Check,
    activeClass: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
    rowClass: "bg-emerald-50/60 dark:bg-emerald-950/20",
    avatarClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  {
    key: "late" as const,
    label: "איחור",
    icon: Clock3,
    activeClass: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
    rowClass: "bg-amber-50/60 dark:bg-amber-950/20",
    avatarClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  {
    key: "absent" as const,
    label: "לא נוכח",
    icon: X,
    activeClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
    rowClass: "bg-rose-50/60 dark:bg-rose-950/20",
    avatarClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  },
] as const;

const CONFIRMED_ROW_CLASS = "border-blue-400/60 bg-blue-50/60 dark:bg-blue-950/20";

type SessionDetailData = {
  attendance: Attendance[];
  [k: string]: unknown;
};

export function AttendancePanel({
  sessionId,
  students,
  attendance,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  attendance: Attendance[];
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (input: { student_id: string; status: Attendance["status"] }) => {
      const r = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["session", sessionId] });
      const prev = qc.getQueryData<SessionDetailData>(["session", sessionId]);
      qc.setQueryData<SessionDetailData>(["session", sessionId], (old) => {
        if (!old) return old;
        const filtered = old.attendance.filter((a) => a.student_id !== input.student_id);
        return {
          ...old,
          attendance: [
            ...filtered,
            {
              session_id: sessionId,
              student_id: input.student_id,
              status: input.status,
              marked_by: "you",
              marked_at: new Date().toISOString(),
            },
          ],
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["session", sessionId], ctx.prev);
      toast.error("שגיאה בשמירת הנוכחות");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["session", sessionId] }),
  });

  function statusFor(studentId: string) {
    return attendance.find((a) => a.student_id === studentId)?.status;
  }

  return (
    <div className="flex flex-col divide-y divide-border mt-4 rounded-xl overflow-hidden border border-border">
      {students.map((s) => {
        const cur = statusFor(s.id);
        const isConfirmed = cur === "confirmed";
        const curConfig = STATUSES.find((st) => st.key === cur);
        return (
          <div
            key={s.id}
            className={cn(
              "flex justify-between items-center px-3 py-2.5 transition-colors",
              curConfig ? curConfig.rowClass : isConfirmed ? CONFIRMED_ROW_CLASS : "bg-background",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none transition-colors",
                  curConfig ? curConfig.avatarClass : "bg-muted text-muted-foreground",
                )}
              >
                {getInitials(studentFullName(s))}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-sm truncate">{studentFullName(s)}</span>
                {isConfirmed && (
                  <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400 shrink-0">
                    אישר הגעה
                  </Badge>
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="flex gap-1 shrink-0">
                {STATUSES.map((st) => {
                  const Icon = st.icon;
                  return (
                    <Button
                      key={st.key}
                      size="icon"
                      variant="outline"
                      disabled={mut.isPending}
                      title={st.label}
                      onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
                      className={cn(
                        "h-8 w-8 transition-all",
                        cur === st.key && st.activeClass,
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
