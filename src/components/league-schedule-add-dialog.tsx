"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayIsoTel } from "@/lib/date";
import { shortDate, type ScheduleMatch, type ScheduleParticipant } from "@/lib/sheets/league-schedule-parse";

// Put one league match on the schedule by hand: pick a date and the two
// players. Only pairs that still have an unplayed match between them can be
// picked (the league's fixtures are fixed by its districts); a pair already
// on another day is moved to the new date.
export function LeagueScheduleAddDialog({
  open,
  onOpenChange,
  participants,
  matches,
  districtLabels,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ScheduleParticipant[];
  matches: ScheduleMatch[];
  districtLabels: Map<string, string>;
  onSave: (assignment: { matchId: string; date: string }) => Promise<void>;
  saving: boolean;
}) {
  const [date, setDate] = useState(todayIsoTel());
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "?";
  const openMatches = useMemo(() => matches.filter((m) => m.frames_a === null), [matches]);

  const playersWithOpen = useMemo(() => {
    const ids = new Set(openMatches.flatMap((m) => [m.participant_a_id, m.participant_b_id]));
    return participants.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [openMatches, participants]);

  const opponents = useMemo(() => {
    const name = (id: string) => participants.find((p) => p.id === id)?.name ?? "?";
    return openMatches
      .filter((m) => m.participant_a_id === playerA || m.participant_b_id === playerA)
      .map((m) => ({ match: m, opponentId: m.participant_a_id === playerA ? m.participant_b_id : m.participant_a_id }))
      .sort((a, b) => name(a.opponentId).localeCompare(name(b.opponentId), "he"));
  }, [openMatches, playerA, participants]);

  const chosen = opponents.find((o) => o.opponentId === playerB)?.match ?? null;
  const showDistrict = districtLabels.size > 1;

  function reset() {
    setPlayerA("");
    setPlayerB("");
  }

  async function save() {
    if (!chosen || !date) return;
    try {
      await onSave({ matchId: chosen.id, date });
      reset();
      onOpenChange(false);
    } catch {
      // The mutation's onError already showed a toast; keep the dialog open.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>הוספת משחק ללוז</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">תאריך</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </label>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">שחקן ראשון</span>
            <Select
              value={playerA}
              onValueChange={(v) => {
                setPlayerA(String(v ?? ""));
                setPlayerB("");
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="בחר שחקן..." />
              </SelectTrigger>
              <SelectContent>
                {playersWithOpen.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">נגד</span>
            <Select value={playerB} onValueChange={(v) => setPlayerB(String(v ?? ""))} disabled={!playerA}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={playerA ? "בחר יריב..." : "קודם בחר שחקן ראשון"} />
              </SelectTrigger>
              <SelectContent>
                {opponents.map(({ match, opponentId }) => (
                  <SelectItem key={match.id} value={opponentId}>
                    {nameOf(opponentId)}
                    {showDistrict ? ` · ${districtLabels.get(match.district_id) ?? ""}` : ""}
                    {match.scheduled_date ? ` (משובץ ל-${shortDate(match.scheduled_date)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {playerA && opponents.length === 0 && (
              <p className="text-xs text-muted-foreground">לשחקן הזה אין משחקים פתוחים</p>
            )}
          </div>

          {chosen?.scheduled_date && chosen.scheduled_date !== date && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              המשחק הזה כבר משובץ ל-{shortDate(chosen.scheduled_date)}. שמירה תעביר אותו ל-{shortDate(date)}.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={save} disabled={!chosen || !date || saving}>
            {saving ? "שומר..." : "הוסף ללוז"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
