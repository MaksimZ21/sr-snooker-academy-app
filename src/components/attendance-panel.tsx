"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Attendance, Student } from "@/lib/sheets/schemas";

const STATUSES = [
  {
    key: "present" as const,
    label: "נוכח",
    activeClass: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
    rowClass: "border-emerald-400/60",
  },
  {
    key: "late" as const,
    label: "איחור",
    activeClass: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
    rowClass: "border-amber-400/60",
  },
  {
    key: "absent" as const,
    label: "לא נוכח",
    activeClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
    rowClass: "border-rose-400/60",
  },
] as const;

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
    <div className="flex flex-col gap-2.5 mt-4">
      {students.map((s) => {
        const cur = statusFor(s.id);
        const curConfig = STATUSES.find((st) => st.key === cur);
        return (
          <div
            key={s.id}
            className={cn(
              "flex justify-between items-center border rounded-lg p-3 transition-colors",
              curConfig?.rowClass,
            )}
          >
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.id}</div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant="outline"
                  disabled={readOnly || mut.isPending}
                  onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
                  className={cn(
                    "text-xs transition-colors",
                    cur === st.key && st.activeClass,
                  )}
                >
                  {st.label}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
