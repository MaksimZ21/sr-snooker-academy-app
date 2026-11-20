"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardPaste, FileDown, ImageDown, Plus, X } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ClearResultButton } from "@/components/clear-result-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatchLine } from "@/components/match-line";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildOpenMatchesText,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";
import { LeagueSchedulePasteDialog } from "@/components/league-schedule-paste-dialog";
import { LeagueScheduleAddDialog } from "@/components/league-schedule-add-dialog";
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
  const [addOpen, setAddOpen] = useState(false);
  // Sunday of the week on screen; null = pick it automatically.
  const [weekStart, setWeekStart] = useState<string | null>(null);
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

  const clearMut = useMutation({
    mutationFn: async (matchId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/matches/${matchId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה במחיקת התוצאה");
      }
    },
    onSuccess: () => {
      toast.success("התוצאה נמחקה");
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה במחיקת התוצאה"),
  });

  // One district's open matches as a .txt file (to hand to whoever plans the week).
  function downloadOpenMatches(district: District) {
    const open = district.matches.filter((m) => m.frames_a === null);
    if (open.length === 0) {
      toast.error(`אין משחקים פתוחים ב${district.label}`);
      return;
    }
    const text = buildOpenMatchesText(`${leagueName} · ${district.label}`, [district], people);
    // BOM so Hebrew opens correctly in Windows Notepad
    const blob = new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `משחקים פתוחים - ${leagueName} - ${district.label}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // The week on screen.
  async function downloadWeekImage() {
    const { startIso, endIso } = week;
    if (weekDays.length === 0) {
      toast.error("אין משחקים משובצים בשבוע הזה");
      return;
    }
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

  // Week navigation: opens on the week of the next match day (or the last
  // one, once the league is over), then moves a week at a time.
  const today = todayIsoTel();
  const currentWeek = weekRangeFor(today);
  const week = weekRangeFor(weekStart ?? days.find((d) => d >= today) ?? days.at(-1) ?? today);
  const weekDays = days.filter((d) => d >= week.startIso && d <= week.endIso);
  const weekCount = datedMatches.filter((m) => weekDays.includes(m.scheduled_date as string)).length;
  const shiftWeek = (n: number) => setWeekStart(format(addDays(parseISO(week.startIso), 7 * n), "yyyy-MM-dd"));

  return (
    <div className="rounded-[18px] border bg-card overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={downloadWeekImage} disabled={weekDays.length === 0}>
          <ImageDown size={14} className="ml-1.5" />
          הורד תמונה של השבוע
        </Button>
        {canEdit && (
          <div className="flex gap-2">
            {filteredDistrict || districts.length === 1 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadOpenMatches(filteredDistrict ?? districts[0])}
              >
                <FileDown size={14} className="ml-1.5" />
                הורד משחקים פתוחים
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={districts.length === 0} />}>
                  <FileDown size={14} className="ml-1.5" />
                  הורד משחקים פתוחים
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-60">
                  {districts.map((d) => (
                    <DropdownMenuItem key={d.id} onClick={() => downloadOpenMatches(d)} className="whitespace-nowrap py-1.5">
                      {d.label}
                      <span className="ms-auto ps-3 text-xs text-muted-foreground tabular-nums">
                        {d.matches.filter((m) => m.frames_a === null).length}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={districts.length === 0}>
              <Plus size={14} className="ml-1.5" />
              הוסף משחק
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
          <>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftWeek(-1)} aria-label="שבוע קודם">
              <ChevronRight size={16} />
            </Button>
            <div className="min-w-40 text-center">
              <p className="font-display text-sm font-extrabold tabular-nums">
                {shortDate(week.startIso)} – {shortDate(week.endIso)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {week.startIso === currentWeek.startIso ? "השבוע · " : ""}
                {weekCount > 0 ? `${weekCount} משחקים` : "אין משחקים"}
              </p>
            </div>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftWeek(1)} aria-label="שבוע הבא">
              <ChevronLeft size={16} />
            </Button>
            {week.startIso !== currentWeek.startIso && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setWeekStart(currentWeek.startIso)}>
                לשבוע הנוכחי
              </Button>
            )}
          </div>
          {weekDays.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">אין משחקים משובצים בשבוע הזה</p>
          ) : (
          <DayColumns
            key={`${districtFilter}:${week.startIso}`}
            items={weekDays.map((day) => {
              const dayMatches = datedMatches.filter((m) => m.scheduled_date === day);
              return {
                day,
                count: dayMatches.length,
                content: (
                  <div className="flex flex-col gap-2">
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
                        onClear={() => clearMut.mutate(m.id)}
                      />
                    ))}
                  </div>
                ),
              };
            })}
          />
          )}
          </>
        )}
      </div>

      {canEdit && (
        <LeagueScheduleAddDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          participants={people}
          matches={allMatches}
          districtLabels={districtLabels}
          onSave={async (a) => {
            await scheduleMut.mutateAsync([a]);
            toast.success("המשחק נוסף ללוז");
          }}
          saving={scheduleMut.isPending}
        />
      )}

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
  onClear,
}: {
  nameA: string;
  nameB: string;
  districtLabel: string;
  match: DistrictMatch;
  canEdit: boolean;
  busy: boolean;
  onSave: (framesA: number, framesB: number) => void;
  onRemove: () => void;
  onClear: () => void;
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

  const box = (value: string, set: (v: string) => void) => (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={trySave}
      className="h-7 w-12 text-center px-1 bc-num text-sm"
      disabled={busy}
    />
  );

  return (
    <MatchLine
      nameA={nameA}
      nameB={nameB}
      framesA={match.frames_a}
      framesB={match.frames_b}
      sub={districtLabel}
      scoreA={canEdit ? box(framesA, setFramesA) : undefined}
      scoreB={canEdit ? box(framesB, setFramesB) : undefined}
      aside={
        canEdit && !played ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="flex items-center gap-0.5 font-display font-bold hover:text-destructive"
            title="הסר מהלוז"
          >
            <X size={12} />
            הסר מהלוז
          </button>
        ) : canEdit && played ? (
          <ClearResultButton onClear={onClear} disabled={busy} />
        ) : undefined
      }
    />
  );
}
