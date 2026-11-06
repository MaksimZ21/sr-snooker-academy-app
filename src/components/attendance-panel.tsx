"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Attendance, Note, Student } from "@/lib/sheets/schemas";
import { useAddSessionNote } from "@/components/notes-panel";
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
const DECLINED_ROW_CLASS = "border-red-400/60 bg-red-50/60 dark:bg-red-950/20";

// The student's own RSVP — normally set by the CRM. Only an admin gets
// buttons to set it by hand (the API enforces the same rule).
const RSVP_STATUSES = [
  {
    key: "confirmed" as const,
    label: "אישר הגעה",
    activeClass: "bg-blue-500 hover:bg-blue-600 text-white border-blue-500",
  },
  {
    key: "declined" as const,
    label: "דחה הגעה",
    activeClass: "bg-red-600 hover:bg-red-700 text-white border-red-600",
  },
] as const;

type SessionDetailData = {
  attendance: Attendance[];
  [k: string]: unknown;
};

function InlineNoteInput({
  initialText,
  onSave,
  onClose,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);

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
        <Button size="sm" variant="ghost" onClick={onClose} className="text-xs h-8">
          ביטול
        </Button>
        <Button size="sm" disabled={!text.trim()} onClick={() => onSave(text.trim())} className="text-xs h-8">
          שמור
        </Button>
      </div>
    </div>
  );
}

function useAttendanceMutation(sessionId: string, studentId: string) {
  const qc = useQueryClient();
  const queryKey = ["session", sessionId];
  const mutationKey = ["attendance", sessionId];

  return useMutation({
    mutationKey,
    mutationFn: async (status: Attendance["status"] | null) => {
      const r = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: status ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(status ? { student_id: studentId, status } : { student_id: studentId }),
      });
      if (!r.ok) throw new Error("write failed");
    },
    // Presses on one student run in order, so a quick correction can't be
    // overwritten by the earlier press finishing last. Different students
    // don't wait for each other.
    scope: { id: `attendance:${sessionId}:${studentId}` },
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<SessionDetailData>(queryKey);
      qc.setQueryData<SessionDetailData>(queryKey, (old) => {
        if (!old) return old;
        const others = old.attendance.filter((a) => a.student_id !== studentId);
        return {
          ...old,
          attendance: status
            ? [...others, { session_id: sessionId, student_id: studentId, status, marked_by: "", marked_at: "" }]
            : others,
        };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      toast.error("שגיאה בשמירת הנוכחות");
    },
    // Only once the last press finished, so a refetch can't briefly undo a
    // press that is still on its way.
    onSettled: () => {
      if (qc.isMutating({ mutationKey }) === 1) qc.invalidateQueries({ queryKey });
    },
  });
}

export function AttendancePanel({
  sessionId,
  students,
  attendance,
  notesByStudent,
  readOnly,
  isAdmin = false,
}: {
  sessionId: string;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
  readOnly: boolean;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 mt-4">
      {students.map((s) => (
        <AttendanceRow
          key={s.id}
          sessionId={sessionId}
          student={s}
          cur={attendance.find((a) => a.student_id === s.id)?.status}
          notes={notesByStudent[s.id] ?? []}
          readOnly={readOnly}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}

function AttendanceRow({
  sessionId,
  student: s,
  cur,
  notes,
  readOnly,
  isAdmin,
}: {
  sessionId: string;
  student: Student;
  cur: Attendance["status"] | undefined;
  notes: Note[];
  readOnly: boolean;
  isAdmin: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const addNote = useAddSessionNote(sessionId, s.id);

  function saveNote(text: string) {
    setNoteOpen(false);
    setNoteDraft("");
    addNote.mutate(text, {
      onError: () => {
        setNoteDraft(text);
        setNoteOpen(true);
      },
    });
  }

  // Every press saves by itself: the screen changes at once from the cache,
  // the request runs behind it, and a failure puts the old status back.
  const markMut = useAttendanceMutation(sessionId, s.id);
  const press = (status: Attendance["status"]) => markMut.mutate(cur === status ? null : status);

  const isConfirmed = cur === "confirmed";
  const isDeclined = cur === "declined";
  const curConfig = STATUSES.find((st) => st.key === cur);

  return (
    <div
      className={cn(
        "flex flex-col border-2 rounded-xl p-3.5",
        curConfig
          ? curConfig.rowClass
          : isConfirmed
            ? CONFIRMED_ROW_CLASS
            : isDeclined
              ? DECLINED_ROW_CLASS
              : "border-border",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3 sm:flex-1 min-w-0">
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none",
              curConfig ? curConfig.avatarClass : "bg-muted text-muted-foreground",
            )}
          >
            {getInitials(studentFullName(s))}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className="font-medium text-sm truncate">{studentFullName(s)}</div>
            {isConfirmed && (
              <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400 shrink-0">
                אישר הגעה
              </Badge>
            )}
            {isDeclined && (
              <Badge variant="outline" className="text-xs border-red-400 text-red-600 dark:text-red-400 shrink-0">
                דחה הגעה
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {STATUSES.map((st) => (
            <Button
              key={st.key}
              size="sm"
              variant="outline"
              disabled={readOnly}
              aria-pressed={cur === st.key}
              onClick={() => press(st.key)}
              className={cn("text-xs h-8 px-3 transition-none", cur === st.key && st.activeClass)}
            >
              {st.label}
            </Button>
          ))}
          {isAdmin && !readOnly && (
            <>
              <span className="w-px h-5 bg-border mx-0.5" aria-hidden />
              {RSVP_STATUSES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant="outline"
                  aria-pressed={cur === st.key}
                  onClick={() => press(st.key)}
                  className={cn("text-xs h-8 px-3 transition-none", cur === st.key && st.activeClass)}
                >
                  {st.label}
                </Button>
              ))}
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setNoteOpen((open) => !open)}
            aria-label="הוסף הערה"
            className={cn(
              "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground",
              noteOpen && "text-foreground bg-muted",
            )}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {noteOpen && (
        <InlineNoteInput initialText={noteDraft} onSave={saveNote} onClose={() => setNoteOpen(false)} />
      )}
      {notes.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border/40 pt-2.5">
          {notes.map((n) => (
            <p key={n.id} className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {n.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
