"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus } from "lucide-react";
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
    activeClass: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
    rowClass: "border-emerald-400/60 bg-emerald-50/60 dark:bg-emerald-950/20",
    avatarClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  {
    key: "late" as const,
    label: "איחור",
    activeClass: "bg-amber-500 hover:bg-amber-600 text-white border-amber-500",
    rowClass: "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20",
    avatarClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  {
    key: "absent" as const,
    label: "לא נוכח",
    activeClass: "bg-rose-500 hover:bg-rose-600 text-white border-rose-500",
    rowClass: "border-rose-400/60 bg-rose-50/60 dark:bg-rose-950/20",
    avatarClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  },
] as const;

const CONFIRMED_ROW_CLASS = "border-blue-400/60 bg-blue-50/60 dark:bg-blue-950/20";

type SessionDetailData = {
  attendance: Attendance[];
  [k: string]: unknown;
};

function InlineNoteInput({
  sessionId,
  studentId,
  onClose,
}: {
  sessionId: string;
  studentId: string;
  onClose: () => void;
}) {
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
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("ההערה נשמרה");
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירת ההערה"),
  });

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="הוסף הערה לשחקן..."
        className="min-h-[72px] resize-none text-sm"
      />
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          disabled={mut.isPending}
          className="text-xs h-8"
        >
          ביטול
        </Button>
        <Button
          size="sm"
          disabled={!text.trim() || mut.isPending}
          onClick={() => mut.mutate(text.trim())}
          className="text-xs h-8"
        >
          שמור
        </Button>
      </div>
    </div>
  );
}

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
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
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
        const isConfirmed = cur === "confirmed";
        const curConfig = STATUSES.find((st) => st.key === cur);
        return (
          <div
            key={s.id}
            className={cn(
              "flex flex-col border-2 rounded-xl p-3.5 transition-all duration-200",
              curConfig ? curConfig.rowClass : isConfirmed ? CONFIRMED_ROW_CLASS : "border-border",
            )}
          >
            <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none transition-colors",
                  curConfig ? curConfig.avatarClass : "bg-muted text-muted-foreground",
                )}
              >
                {getInitials(studentFullName(s))}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-medium text-sm truncate">{studentFullName(s)}</div>
                {isConfirmed && (
                  <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400 shrink-0">
                    אישר הגעה
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {STATUSES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant="outline"
                  disabled={readOnly || mut.isPending}
                  onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
                  className={cn(
                    "text-xs h-8 px-3 transition-all",
                    cur === st.key && st.activeClass,
                  )}
                >
                  {st.label}
                </Button>
              ))}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpenNoteId(openNoteId === s.id ? null : s.id)}
                className={cn(
                  "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground",
                  openNoteId === s.id && "text-foreground bg-muted",
                )}
              >
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {openNoteId === s.id && (
            <InlineNoteInput
              sessionId={sessionId}
              studentId={s.id}
              onClose={() => setOpenNoteId(null)}
            />
          )}
          </div>
        );
      })}
    </div>
  );
}
