"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { computeLeagueStandings } from "@/lib/sheets/tournament-logic";
import { LeagueStandingsTable, type StandingLevel } from "@/components/league-standings-table";
import type { LeagueLevelRow } from "@/lib/sheets/league-levels";
import { DistrictSwitcher } from "@/components/district-switcher";
import { dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

type Participant = {
  id: string;
  student_id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type DistrictMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  scheduled_date: string | null;
};

type DistrictWithMatches = {
  id: string;
  league_id: string;
  label: string;
  num_cycles: number;
  matches: DistrictMatch[];
  memberIds: string[];
};

export function LeagueDistrictsView({
  leagueId,
  participants,
  canEdit,
}: {
  leagueId: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newNumCycles, setNewNumCycles] = useState("1");

  const { data, isLoading } = useQuery({
    queryKey: ["league-districts", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: DistrictWithMatches[] };
    },
  });

  // Same query as the level-tracking section, so they share one fetch.
  const { data: levelData } = useQuery({
    queryKey: ["league-districts", leagueId, "levels"],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/levels`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { rows: LeagueLevelRow[] };
    },
  });
  const levelByStudent = new Map((levelData?.rows ?? []).map((r) => [r.studentId, r]));
  const levelsByParticipant: Record<string, StandingLevel> = Object.fromEntries(
    participants.flatMap((p) => {
      const r = levelByStudent.get(p.student_id);
      return r ? [[p.id, { level: r.level, points: r.points }]] : [];
    }),
  );

  const addDistrictMut = useMutation({
    mutationFn: async ({ label, numCycles }: { label: string; numCycles: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, numCycles }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המחוז נוסף");
      setNewLabel("");
      setNewNumCycles("1");
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: () => toast.error("שגיאה בהוספת מחוז"),
  });

  const generateMut = useMutation({
    mutationFn: async (districtId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts/${districtId}/generate`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("לוח המשחקים נוצר");
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה ביצירת לוח המשחקים"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: () => toast.error("שגיאה בשמירת התוצאה"),
  });

  const scheduleMut = useMutation({
    mutationFn: async ({ matchId, date }: { matchId: string; date: string | null }) => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments: [{ matchId, date }] }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשיבוץ");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשיבוץ"),
  });

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  const districts = data?.districts ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">מחוז חדש</label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="למשל: צפון" dir="auto" />
          </div>
          <div className="w-28">
            <label className="text-xs text-muted-foreground mb-1 block">מספר סיבובים</label>
            <Input type="number" min={1} value={newNumCycles} onChange={(e) => setNewNumCycles(e.target.value)} />
          </div>
          <Button
            onClick={() => addDistrictMut.mutate({ label: newLabel.trim(), numCycles: Number(newNumCycles) || 1 })}
            disabled={!newLabel.trim() || addDistrictMut.isPending}
          >
            <Plus size={14} className="ml-1.5" />
            הוסף מחוז
          </Button>
        </div>
      )}

      {districts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין אין מחוזות
        </div>
      ) : (
        <DistrictSwitcher
          items={districts.map((district) => {
          const standings = computeLeagueStandings(district.memberIds, district.matches);
          const hasFixtures = district.matches.length > 0;
          const hasResults = district.matches.some((m) => m.frames_a !== null);
          const rounds = [...new Set(district.matches.map((m) => m.round))].sort((a, b) => a - b);
          return {
            id: district.id,
            label: district.label,
            content: (
            <div key={district.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div>
                  <p className="text-sm font-semibold">{district.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {district.num_cycles === 1 ? "סיבוב אחד" : `${district.num_cycles} סיבובים`}
                  </p>
                </div>
                {canEdit && !hasResults && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generateMut.isPending || district.memberIds.length < 2}
                    onClick={() => {
                      if (hasFixtures && !window.confirm("כבר יש לוח משחקים במחוז זה — יצירה מחדש תמחק אותו. להמשיך?")) return;
                      generateMut.mutate(district.id);
                    }}
                  >
                    {hasFixtures ? "צור לוח משחקים מחדש" : "צור לוח משחקים"}
                  </Button>
                )}
              </div>

              <LeagueStandingsTable rows={standings} renderName={participantName} levels={levelsByParticipant} />

              {hasFixtures && (
                <div className="flex flex-col gap-3 px-4 py-3 border-t border-border/40">
                  {rounds.map((round) => (
                    <div key={round} className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">מחזור {round}</p>
                      {district.matches
                        .filter((m) => m.round === round)
                        .map((m) => {
                          const nameA = participantName(m.participant_a_id);
                          const nameB = participantName(m.participant_b_id);
                          return (
                            <MatchRow
                              key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                              nameA={nameA}
                              nameB={nameB}
                              match={m}
                              canEdit={canEdit}
                              onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                              saving={resultMut.isPending}
                              onSchedule={(date) => scheduleMut.mutate({ matchId: m.id, date })}
                            />
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            ),
          };
        })}
        />
      )}
    </div>
  );
}

function MatchRow({
  nameA,
  nameB,
  match,
  canEdit,
  onSave,
  saving,
  onSchedule,
}: {
  nameA: string;
  nameB: string;
  match: DistrictMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
  onSchedule: (date: string | null) => void;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

  // Saves on blur (or Enter) once both boxes hold a valid score — no Save
  // button, same as the weekly schedule. Unchanged values don't resave
  // (each save re-runs the rating update).
  function trySave() {
    const a = framesA.trim();
    const b = framesB.trim();
    const na = Number(a);
    const nb = Number(b);
    // Number("") and Number(" ") both coerce to 0 — trim + explicit
    // emptiness + Number.isInteger together are required to reject a
    // whitespace-only input instead of silently recording a 0 result.
    if (a === "" || b === "" || !Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) return;
    if (played && na === match.frames_a && nb === match.frames_b) return;
    onSave(na, nb);
  }
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">{nameA} נגד {nameB}</span>
        {canEdit ? (
          <>
            <Input
              type="number"
              min={0}
              value={framesA}
              onChange={(e) => setFramesA(e.target.value)}
              onBlur={trySave}
              onKeyDown={onEnter}
              className="h-7 w-14 text-center px-1"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              value={framesB}
              onChange={(e) => setFramesB(e.target.value)}
              onBlur={trySave}
              onKeyDown={onEnter}
              className="h-7 w-14 text-center px-1"
            />
          </>
        ) : played ? (
          <span className="font-medium">{match.frames_a} - {match.frames_b}</span>
        ) : (
          <span className="text-muted-foreground text-xs">טרם שוחק</span>
        )}
      </div>
      {canEdit && !played ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>יום משחק:</span>
          <Input
            type="date"
            value={match.scheduled_date ?? ""}
            onChange={(e) => onSchedule(e.target.value || null)}
            className="h-7 w-40 text-xs"
          />
        </div>
      ) : (
        match.scheduled_date && (
          <p className="text-[11px] text-muted-foreground">
            {dayLabelHe(match.scheduled_date)} {shortDate(match.scheduled_date)}
          </p>
        )
      )}
    </div>
  );
}
