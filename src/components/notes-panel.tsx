"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Note, Student } from "@/lib/sheets/schemas";

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
    <div className="flex flex-col gap-3 mt-4">
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
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => toast.error("שגיאה בשמירת ההערה"),
  });

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border/60">
        <div className="w-8 h-8 rounded-full bg-primary/12 text-primary flex items-center justify-center text-xs font-bold shrink-0 select-none">
          {getInitials(student.name)}
        </div>
        <div className="flex-1 flex items-baseline justify-between gap-2 min-w-0">
          <h3 className="font-semibold text-sm truncate">{student.name}</h3>
          {notes.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{notes.length} הערות</span>
          )}
        </div>
      </div>

      {notes.length > 0 && (
        <div className="flex flex-col gap-2 p-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="bg-muted/50 border border-border/40 rounded-lg px-3 py-2.5"
            >
              <p className="text-sm leading-relaxed">{n.text}</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {new Date(n.created_at).toLocaleString("he-IL")} · {n.coach_email}
              </p>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div
          className={cn(
            "p-3 bg-background",
            notes.length > 0 && "border-t border-border/60",
          )}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הוסף הערה..."
            className="min-h-[72px] resize-none text-sm"
          />
          <Button
            disabled={!text.trim() || mut.isPending}
            onClick={() => mut.mutate(text.trim())}
            size="sm"
            className="mt-2"
          >
            שמור
          </Button>
        </div>
      )}

      {readOnly && notes.length === 0 && (
        <div className="p-4 text-center text-xs text-muted-foreground/60">אין הערות</div>
      )}
    </div>
  );
}
