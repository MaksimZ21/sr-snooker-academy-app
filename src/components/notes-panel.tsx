"use client";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Send, X } from "lucide-react";
import type { Note, NoteVisibility, Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function NoteTeamBadge({ note }: { note: Pick<Note, "visibility"> }) {
  if (note.visibility !== "team") return null;
  return (
    <span className="inline-block shrink-0 rounded-full border border-amber-400 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
      צוותית
    </span>
  );
}

// Says who will read the note, right where it's written.
export function NoteVisibilityPicker({
  value,
  onChange,
}: {
  value: NoteVisibility;
  onChange: (value: NoteVisibility) => void;
}) {
  const options: { key: NoteVisibility; label: string; hint: string; active: string }[] = [
    { key: "student", label: "הערה לאימון", hint: "גם המתאמן רואה", active: "border-primary bg-primary/10 text-primary" },
    { key: "team", label: "הערה צוותית", hint: "רק מאמן ואדמין", active: "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-lg border px-2 py-1.5 text-center",
            value === o.key ? o.active : "border-border/60 text-muted-foreground",
          )}
        >
          <span className="block text-xs font-semibold">{o.label}</span>
          <span className="block text-[10px] opacity-80">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

type SessionWithNotes = { notesByStudent: Record<string, Note[]>; [k: string]: unknown };

// Shows the note at once from the cache and saves behind it; a failure removes
// it again. Waiting for the whole session page to reload made saving feel stuck.
export function useAddSessionNote(sessionId: string, studentId: string) {
  const qc = useQueryClient();
  const queryKey = ["session", sessionId];

  return useMutation({
    mutationFn: async ({ text, visibility }: { text: string; visibility: NoteVisibility }) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, text, visibility }),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onMutate: async ({ text, visibility }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<SessionWithNotes>(queryKey);
      const note: Note = {
        id: `${PENDING_PREFIX}${Date.now()}`,
        student_id: studentId,
        session_id: sessionId,
        coach_email: "",
        text,
        visibility,
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
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      toast.error("ההערה לא נשמרה, נסה שוב");
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}

const PENDING_PREFIX = "pending-";

// Same approach as adding: gone from the screen at once, back if it fails.
function useDeleteSessionNote(sessionId: string, studentId: string) {
  const qc = useQueryClient();
  const queryKey = ["session", sessionId];

  return useMutation({
    mutationFn: async (noteId: string) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note_id: noteId }),
      });
      if (!r.ok) throw new Error("delete failed");
    },
    onMutate: async (noteId) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<SessionWithNotes>(queryKey);
      qc.setQueryData<SessionWithNotes>(queryKey, (old) =>
        old && {
          ...old,
          notesByStudent: {
            ...old.notesByStudent,
            [studentId]: (old.notesByStudent[studentId] ?? []).filter((n) => n.id !== noteId),
          },
        },
      );
      return { previous };
    },
    onError: (_error, _noteId, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
      toast.error("ההערה לא נמחקה, נסה שוב");
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}

// A note still being saved has no real id yet, so it can't be deleted until
// the save finishes.
export function DeleteNoteButton({
  sessionId,
  studentId,
  noteId,
}: {
  sessionId: string;
  studentId: string;
  noteId: string;
}) {
  const mut = useDeleteSessionNote(sessionId, studentId);
  if (noteId.startsWith(PENDING_PREFIX)) return null;
  return (
    <button
      type="button"
      aria-label="מחק הערה"
      title="מחק הערה"
      onClick={() => {
        if (window.confirm("למחוק את ההערה?")) mut.mutate(noteId);
      }}
      className="shrink-0 rounded p-1 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
    >
      <X size={14} />
    </button>
  );
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
  const [visibility, setVisibility] = useState<NoteVisibility>("student");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mut = useAddSessionNote(sessionId, student.id);

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    textareaRef.current?.focus();
    mut.mutate({ text: t, visibility }, { onError: () => setText(t) });
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
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <NoteTeamBadge note={n} />
              <p className="text-sm leading-relaxed">{n.text}</p>
              <p className="text-[11px] text-muted-foreground/55 mt-1">
                {new Date(n.created_at).toLocaleString("he-IL", {
                  day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            {!readOnly && <DeleteNoteButton sessionId={sessionId} studentId={student.id} noteId={n.id} />}
          </div>
        </div>
      ))}

      {/* Chat-style input */}
      {!readOnly && (
        <div className="flex flex-col gap-2 p-2 border-t border-border/40 bg-background/60">
          <NoteVisibilityPicker value={visibility} onChange={setVisibility} />
          <div className="flex items-end gap-2">
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
