"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Same limit as the server (PARTICIPANT_NOTE_MAX_LENGTH); that module is server-only.
const MAX_LENGTH = 200;
const HINT = "הערה לטורניר הזה, רק לצוות";

type WithNotes = { participantNotes?: Record<string, string>; [k: string]: unknown };

// A short note on a player in this tournament only. Shown on the staff
// tournament screen, never to players.
export function ParticipantNote({
  tournamentId,
  participantId,
  note,
  canEdit,
}: {
  tournamentId: string;
  participantId: string;
  note: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["tournament", tournamentId];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);

  const show = (text: string) =>
    qc.setQueryData<WithNotes>(queryKey, (old) =>
      old && { ...old, participantNotes: { ...(old.participantNotes ?? {}), [participantId]: text } },
    );

  const mut = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}/note`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error("save failed");
    },
    onMutate: async (text) => {
      await qc.cancelQueries({ queryKey });
      show(text);
    },
    onError: () => {
      show(note);
      toast.error("ההערה לא נשמרה, נסה שוב");
    },
  });

  function save(text: string) {
    setOpen(false);
    if (text.trim() !== note) mut.mutate(text.trim());
  }

  function startEditing() {
    setDraft(note);
    setOpen(true);
  }

  if (open) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <Input
          autoFocus
          value={draft}
          maxLength={MAX_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(draft);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={HINT}
          className="h-8 text-sm flex-1 min-w-0"
        />
        <Button size="sm" onClick={() => save(draft)} className="h-8 text-xs">
          שמור
        </Button>
        {note && (
          <Button size="sm" variant="ghost" onClick={() => save("")} className="h-8 text-xs text-destructive">
            מחק
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-8 text-xs">
          ביטול
        </Button>
      </div>
    );
  }

  if (!note) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={startEditing}
        className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground"
      >
        <Pin size={11} />
        הוסף הערה
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={startEditing}
      title={HINT}
      className={cn(
        "mt-0.5 flex items-start gap-1 text-right text-xs text-amber-700 dark:text-amber-400",
        canEdit && "hover:underline",
      )}
    >
      <Pin size={12} className="shrink-0 mt-0.5" />
      <span className="whitespace-pre-wrap break-words">{note}</span>
    </button>
  );
}
