"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Note, Student } from "@/lib/sheets/schemas";

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
    <div className="flex flex-col gap-4 mt-4">
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
    <div className="border rounded p-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{student.name}</h3>
        <span className="text-xs text-muted-foreground">{notes.length} הערות</span>
      </div>
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הוסף הערה..."
          />
          <Button
            disabled={!text.trim() || mut.isPending}
            onClick={() => mut.mutate(text.trim())}
            className="self-start"
          >
            שמור
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 mt-2">
        {notes.map((n) => (
          <div key={n.id} className="text-sm border-r-2 pr-3 border-primary/30">
            <p>{n.text}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("he-IL")} · {n.coach_email}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
