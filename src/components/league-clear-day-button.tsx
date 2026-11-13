"use client";
import { CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

// Clears the play date of every unplayed match on one day. Matches that
// already have a result keep their date.
export function ClearDayButton({
  day,
  matches,
  busy,
  onClear,
}: {
  day: string;
  matches: { id: string; frames_a: number | null }[];
  busy: boolean;
  onClear: (matchIds: string[]) => void;
}) {
  const open = matches.filter((m) => m.frames_a === null).map((m) => m.id);
  if (open.length === 0) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-destructive"
      disabled={busy}
      onClick={() => {
        if (window.confirm(`לבטל את השיבוץ של ${open.length} משחקים ביום ${dayLabelHe(day)} ${shortDate(day)}?`)) {
          onClear(open);
        }
      }}
    >
      <CalendarX size={13} className="ml-1" />
      בטל שיבוץ
    </Button>
  );
}
