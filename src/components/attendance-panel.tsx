"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Attendance, Student } from "@/lib/sheets/schemas";

const STATUSES: { key: Attendance["status"]; label: string }[] = [
  { key: "present", label: "נוכח" },
  { key: "late", label: "איחור" },
  { key: "absent", label: "לא נוכח" },
];

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
    <div className="flex flex-col gap-3 mt-4">
      {students.map((s) => {
        const cur = statusFor(s.id);
        return (
          <div key={s.id} className="flex justify-between items-center border rounded p-3">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.id}</div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant={cur === st.key ? "default" : "outline"}
                  disabled={readOnly || mut.isPending}
                  onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
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
