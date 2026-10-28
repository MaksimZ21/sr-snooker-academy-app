"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, ClipboardCopy, ClipboardPaste, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import {
  buildOpenMatchesText,
  shortDate,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";
import { LeagueSchedulePasteDialog } from "@/components/league-schedule-paste-dialog";

type Participant = { id: string; student: { first_name: string; last_name: string } };
type DistrictMatch = ScheduleMatch & { round: number; frames_b: number | null };
type District = { id: string; label: string; matches: DistrictMatch[] };

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
  const [anchor, setAnchor] = useState(todayIsoTel());
  const [pasteOpen, setPasteOpen] = useState(false);
  const { startIso, endIso } = weekRangeFor(anchor);

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

  async function savePasted(assignments: { matchId: string; date: string }[]) {
    await scheduleMut.mutateAsync(assignments);
    toast.success(`שובצו ${assignments.length} משחקים`);
  }

  const weekMatches = allMatches.filter(
    (m) => m.scheduled_date !== null && m.scheduled_date >= startIso && m.scheduled_date <= endIso,
  );
  const days = [...new Set(weekMatches.map((m) => m.scheduled_date as string))].sort();

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 flex-wrap">
        <p className="text-sm font-semibold">לוז</p>
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

      <div className="flex items-center justify-between px-4 pb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(format(addDays(parseISO(startIso), -7), "yyyy-MM-dd"))}
          aria-label="שבוע קודם"
        >
          <ChevronRight size={16} />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {shortDate(startIso)} – {shortDate(endIso)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(format(addDays(parseISO(startIso), 7), "yyyy-MM-dd"))}
          aria-label="שבוע הבא"
        >
          <ChevronLeft size={16} />
        </Button>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין משחקים משובצים בשבוע הזה</p>
        ) : (
          days.map((day) => (
            <div key={day} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {dayLabelHe(day)} · {shortDate(day)}
              </p>
              {weekMatches
                .filter((m) => m.scheduled_date === day)
                .map((m) => (
                  <ScheduleRow
                    key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                    nameA={nameOf(m.participant_a_id)}
                    nameB={nameOf(m.participant_b_id)}
                    districtLabel={districtLabels.get(m.district_id) ?? ""}
                    match={m}
                    canEdit={canEdit}
                    busy={resultMut.isPending || scheduleMut.isPending}
                    onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                    onRemove={() => scheduleMut.mutate([{ matchId: m.id, date: null }])}
                  />
                ))}
            </div>
          ))
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
    if (na === nb) {
      toast.error("משחק לא יכול להסתיים בתיקו");
      return;
    }
    onSave(na, nb);
  }

  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <div className="flex-1 min-w-0">
        <p className="truncate">{nameA} נגד {nameB}</p>
        <p className="text-[11px] text-muted-foreground">{districtLabel}</p>
      </div>
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
  );
}
