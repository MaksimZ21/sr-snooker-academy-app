"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Attendance, Student, Note } from "@/lib/sheets/schemas";
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
    activeClass: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
    rowClass: "bg-emerald-50/60 dark:bg-emerald-950/20",
    avatarClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  {
    key: "late" as const,
    label: "איחור",
    activeClass: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
    rowClass: "bg-amber-50/60 dark:bg-amber-950/20",
    avatarClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  {
    key: "absent" as const,
    label: "לא נוכח",
    activeClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
    rowClass: "bg-rose-50/60 dark:bg-rose-950/20",
    avatarClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  },
] as const;

type SessionDetailData = {
  attendance: Attendance[];
  [k: string]: unknown;
};

function NoteInput({ sessionId, studentId }: { sessionId: string; studentId: string }) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (t: string) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, text: t }),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => toast.error("שגיאה בשמירת ההערה"),
  });

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim() && !mut.isPending) {
            mut.mutate(text.trim());
          }
        }}
        placeholder="הוסף הערה לאימון..."
        className="flex-1 text-xs bg-muted/40 border border-border/40 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50 transition-colors"
      />
      {text.trim() && (
        <Button
          size="sm"
          variant="ghost"
          disabled={mut.isPending}
          onClick={() => mut.mutate(text.trim())}
          className="h-7 px-2 text-xs shrink-0"
        >
          שמור
        </Button>
      )}
    </div>
  );
}

export function AttendancePanel({
  sessionId,
  students,
  attendance,
  notesByStudent,
  readOnly,
  readOnlyNotes,
}: {
  sessionId: string;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
  readOnly: boolean;
  readOnlyNotes: boolean;
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
    <div className="flex flex-col mt-4 border border-border/60 rounded-xl overflow-hidden divide-y divide-border/60">
      {students.map((s) => {
        const cur = statusFor(s.id);
        const isConfirmed = cur === "confirmed";
        const curConfig = STATUSES.find((st) => st.key === cur);
        const notes = notesByStudent[s.id] ?? [];

        return (
          <div
            key={s.id}
            className={cn(
              "px-3 pt-3 pb-2.5 transition-colors",
              curConfig ? curConfig.rowClass : isConfirmed ? "bg-blue-50/60 dark:bg-blue-950/20" : "bg-background",
            )}
          >
            {/* Name row */}
            <div className="flex items-center gap-2 mb-2.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none",
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

            {/* Attendance buttons */}
            {!readOnly && (
              <div className="flex gap-1.5 mr-10 mb-2">
                {STATUSES.map((st) => (
                  <Button
                    key={st.key}
                    size="sm"
                    variant="outline"
                    disabled={mut.isPending}
                    onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
                    className={cn(
                      "text-xs h-8 px-3 transition-all flex-1",
                      cur === st.key && st.activeClass,
                    )}
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="mr-10">
              {notes.length > 0 && (
                <div className="flex flex-col gap-1 mb-1.5">
                  {notes.map((n) => (
                    <p key={n.id} className="text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1 leading-relaxed">
                      {n.text}
                    </p>
                  ))}
                </div>
              )}
              {!readOnlyNotes && (
                <NoteInput sessionId={sessionId} studentId={s.id} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
