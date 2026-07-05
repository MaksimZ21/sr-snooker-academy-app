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
    <div className="flex flex-col gap-2.5 mt-3">
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
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (t: string) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: student.id, text: t }),
      });
      if (!r.ok) throw new Error("write failed");
      return (await r.json()) as { note: Note };
    },
    onSuccess: () => {
      setText("");
      textareaRef.current?.focus();
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => toast.error("שגיאה בשמירת ההערה"),
  });

  function submit() {
    if (text.trim() && !mut.isPending) mut.mutate(text.trim());
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
            disabled={!text.trim() || mut.isPending}
            onClick={submit}
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
