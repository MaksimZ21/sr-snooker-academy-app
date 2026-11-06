"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import type { Note, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type SessionWithNotes = { notesByStudent: Record<string, Note[]>; [k: string]: unknown };

// Shows the note at once from the cache and saves behind it; a failure removes
// it again. Waiting for the whole session page to reload made saving feel stuck.
export function useAddSessionNote(sessionId: string, studentId: string) {
  const qc = useQueryClient();
  const queryKey = ["session", sessionId];

  return useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, text }),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<SessionWithNotes>(queryKey);
      const note: Note = {
        id: `pending-${Date.now()}`,
        student_id: studentId,
        session_id: sessionId,
        coach_email: "",
        text,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<SessionWithNotes>(queryKey, (old) =>
        old && {
          ...old,
          notesByStudent: { ...old.notesByStudent, [studentId]: [note, ...(old.notesByStudent[studentId] ?? [])] },
        },
      );
      return { previous };
    },
    onError: (_error, _text, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      toast.error("ההערה לא נשמרה, נסה שוב");
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}

export function NotesPanel({
  sessionId,
  students,
  notesByStudent,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  notesByStudent: Record<string, Note[]>;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {students.map((s) => (
        <StudentNotes
          key={s.id}
          sessionId={sessionId}
          student={s}
          notes={notesByStudent[s.id] ?? []}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function StudentNotes({
  sessionId,
  student,
  notes,
  readOnly,
}: {
  sessionId: string;
  student: Student;
  notes: Note[];
  readOnly: boolean;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mut = useAddSessionNote(sessionId, student.id);

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    textareaRef.current?.focus();
    mut.mutate(t, { onError: () => setText(t) });
  }

  const name = studentFullName(student);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      {/* Student header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/30">
        <div className="w-7 h-7 rounded-full bg-primary/12 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 select-none">
          {getInitials(name)}
        </div>
        <span className="font-semibold text-sm flex-1 truncate">{name}</span>
        {notes.length > 0 && (
          <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">
            {notes.length}
          </span>
        )}
      </div>

      {/* Existing notes */}
      {notes.map((n, i) => (
        <div
          key={n.id}
          className={cn(
            "px-3 py-2.5 border-t border-border/40",
            i % 2 === 0 ? "bg-background" : "bg-muted/20",
          )}
        >
          <p className="text-sm leading-relaxed">{n.text}</p>
          <p className="text-[11px] text-muted-foreground/55 mt-1">
            {new Date(n.created_at).toLocaleString("he-IL", {
              day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      ))}

      {/* Chat-style input */}
      {!readOnly && (
        <div className="flex items-end gap-2 p-2 border-t border-border/40 bg-background/60">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="הערה... (Ctrl+Enter לשמירה)"
            className="flex-1 min-h-[38px] max-h-28 resize-none text-sm py-2 leading-snug border-border/50"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!text.trim()}
            onClick={submit}
            aria-label="שמור הערה"
          >
            <Send size={14} />
          </Button>
        </div>
      )}

      {readOnly && notes.length === 0 && (
        <div className="px-3 py-3 text-center text-xs text-muted-foreground/50 border-t border-border/40">
          אין הערות
        </div>
      )}
    </div>
  );
}
