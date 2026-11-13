"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, ClipboardPaste, ImageDown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildOpenMatchesText,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";
import { LeagueSchedulePasteDialog } from "@/components/league-schedule-paste-dialog";
import { ClearDayButton } from "@/components/league-clear-day-button";
import { DayColumns } from "@/components/day-strip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";
import { drawScheduleImage } from "@/lib/league-schedule-image";

type Participant = { id: string; student: { first_name: string; last_name: string } };
type DistrictMatch = ScheduleMatch & { round: number; frames_b: number | null };
type District = { id: string; label: string; matches: DistrictMatch[] };

const ALL_DISTRICTS = "__all__";

export function LeagueScheduleView({
  leagueId,
  leagueName,
  participants,
  canEdit,
}: {
  leagueId: string;
  leagueName: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [districtFilter, setDistrictFilter] = useState(ALL_DISTRICTS);

  // Same key and URL as LeagueDistrictsView, so the two share one cache entry.
  const { data, isLoading } = useQuery({
    queryKey: ["league-districts", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: District[] };
    },
  });

  const people: ScheduleParticipant[] = useMemo(
    () => participants.map((p) => ({ id: p.id, name: [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") })),
    [participants],
  );
  const districts = useMemo(() => data?.districts ?? [], [data]);
  const allMatches = useMemo(() => districts.flatMap((d) => d.matches), [districts]);
  const districtLabels = useMemo(() => new Map(districts.map((d) => [d.id, d.label])), [districts]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";

  const scheduleMut = useMutation({
    mutationFn: async (assignments: { matchId: string; date: string | null }[]) => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשמירת הלוז");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת הלוז"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשמירת התוצאה");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת התוצאה"),
  });

  async function copyOpenMatches() {
    try {
      await navigator.clipboard.writeText(buildOpenMatchesText(leagueName, districts, people));
      toast.success("המשחקים הפתוחים הועתקו");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  // The week (Sun-Sat) of the next day that has matches, from today on.
  async function downloadWeekImage() {
    const today = todayIsoTel();
    const nextDay = days.find((d) => d >= today);
    if (!nextDay) {
      toast.error("אין משחקים משובצים מהיום והלאה");
      return;
    }
    const { startIso, endIso } = weekRangeFor(nextDay);
    const weekDays = days.filter((d) => d >= startIso && d <= endIso);
    try {
      const blob = await drawScheduleImage({
        leagueName: filteredDistrict ? `${leagueName} · ${filteredDistrict.label}` : leagueName,
        rangeLabel: `${shortDate(startIso)} – ${shortDate(endIso)}`,
        days: weekDays.map((day) => ({
          title: `${dayLabelHe(day)} · ${shortDate(day)}`,
          matches: datedMatches
            .filter((m) => m.scheduled_date === day)
            .map((m) => ({
              a: nameOf(m.participant_a_id),
              b: nameOf(m.participant_b_id),
              district: showDistrict ? (districtLabels.get(m.district_id) ?? "") : "",
            })),
        })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `לוז ${leagueName} ${shortDate(startIso)}-${shortDate(endIso)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("יצירת התמונה נכשלה");
    }
  }

  async function savePasted(assignments: { matchId: string; date: string }[]) {
    await scheduleMut.mutateAsync(assignments);
    toast.success(`שובצו ${assignments.length} משחקים`);
  }

  // Which district the schedule shows; ALL_DISTRICTS = every district.
  const filteredDistrict = districts.find((d) => d.id === districtFilter);
  const datedMatches = allMatches.filter(
    (m) => m.scheduled_date !== null && (!filteredDistrict || m.district_id === filteredDistrict.id),
  );
  // The district name on each row only when several districts are mixed.
  const showDistrict = !filteredDistrict && districts.length > 1;
  const days = [...new Set(datedMatches.map((m) => m.scheduled_date as string))].sort();

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={downloadWeekImage} disabled={days.length === 0}>
          <ImageDown size={14} className="ml-1.5" />
          הורד תמונה של השבוע
        </Button>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyOpenMatches} disabled={districts.length === 0}>
              <ClipboardCopy size={14} className="ml-1.5" />
              העתק משחקים פתוחים
            </Button>
            <Button size="sm" onClick={() => setPasteOpen(true)} disabled={districts.length === 0}>
              <ClipboardPaste size={14} className="ml-1.5" />
              הדבק לוז
            </Button>
          </div>
        )}
      </div>

      {districts.length > 1 && (
        <div className="flex items-center gap-2 px-4 pb-2 text-sm">
          <span className="text-muted-foreground">מחוז:</span>
          <Select value={districtFilter} onValueChange={(v) => setDistrictFilter(v ?? ALL_DISTRICTS)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DISTRICTS}>כל המחוזות</SelectItem>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין משחקים משובצים</p>
        ) : (
          <DayColumns
            key={districtFilter}
            items={days.map((day) => {
              const dayMatches = datedMatches.filter((m) => m.scheduled_date === day);
              return {
                day,
                count: dayMatches.length,
                content: (
                  <div className="flex flex-col gap-1">
                    {canEdit && (
                      <div className="flex justify-end">
                        <ClearDayButton
                          day={day}
                          matches={dayMatches}
                          busy={scheduleMut.isPending}
                          onClear={(ids) =>
                            scheduleMut.mutate(
                              ids.map((matchId) => ({ matchId, date: null })),
                              { onSuccess: () => toast.success(`בוטל שיבוץ של ${ids.length} משחקים`) },
                            )
                          }
                        />
                      </div>
                    )}
                    {dayMatches.map((m) => (
                      <ScheduleRow
                        key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                        nameA={nameOf(m.participant_a_id)}
                        nameB={nameOf(m.participant_b_id)}
                        districtLabel={showDistrict ? (districtLabels.get(m.district_id) ?? "") : ""}
                        match={m}
                        canEdit={canEdit}
                        busy={resultMut.isPending || scheduleMut.isPending}
                        onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                        onRemove={() => scheduleMut.mutate([{ matchId: m.id, date: null }])}
                      />
                    ))}
                  </div>
                ),
              };
            })}
          />
        )}
      </div>

      {canEdit && (
        <LeagueSchedulePasteDialog
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          participants={people}
          matches={allMatches}
          districtLabels={districtLabels}
          onSave={savePasted}
          saving={scheduleMut.isPending}
        />
      )}
    </div>
  );
}

function ScheduleRow({
  nameA,
  nameB,
  districtLabel,
  match,
  canEdit,
  busy,
  onSave,
  onRemove,
}: {
  nameA: string;
  nameB: string;
  districtLabel: string;
  match: DistrictMatch;
  canEdit: boolean;
  busy: boolean;
  onSave: (framesA: number, framesB: number) => void;
  onRemove: () => void;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

  // Saves on blur once both boxes hold a valid score — no Save button,
  // same as the tournament result inputs. Unchanged values don't resave
  // (each save re-runs the rating update).
  function trySave() {
    const a = framesA.trim();
    const b = framesB.trim();
    const na = Number(a);
    const nb = Number(b);
    if (a === "" || b === "" || !Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) return;
    if (played && na === match.frames_a && nb === match.frames_b) return;
    onSave(na, nb);
  }

  return (
    <div className="flex flex-col gap-1 text-sm py-1.5 border-b border-border/30 last:border-b-0">
      <p className="leading-snug">
        {nameA} <span className="text-muted-foreground">נגד</span> {nameB}
      </p>
      <div className="flex items-center gap-2">
      <span className="flex-1 min-w-0 truncate text-[11px] text-muted-foreground">{districtLabel}</span>
      {canEdit ? (
        <>
          <Input
            type="number"
            min={0}
            value={framesA}
            onChange={(e) => setFramesA(e.target.value)}
            onBlur={trySave}
            className="h-7 w-14 text-center px-1"
            disabled={busy}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min={0}
            value={framesB}
            onChange={(e) => setFramesB(e.target.value)}
            onBlur={trySave}
            className="h-7 w-14 text-center px-1"
            disabled={busy}
          />
          {!played && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={busy}
              aria-label="הסר מהלוז"
              title="הסר מהלוז"
            >
              <X size={14} />
            </Button>
          )}
        </>
      ) : played ? (
        <span className="font-medium tabular-nums">{match.frames_a} - {match.frames_b}</span>
      ) : (
        <span className="text-muted-foreground text-xs">טרם שוחק</span>
      )}
      </div>
    </div>
  );
}
