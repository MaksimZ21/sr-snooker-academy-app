"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HandicapDistrict } from "@/lib/sheets/handicap";
import { computeLeagueStandings } from "@/lib/sheets/tournament-logic";
import { LeagueStandingsTable, remainingMatchesByParticipant, type StandingLevel } from "@/components/league-standings-table";
import type { LeagueLevelRow } from "@/lib/sheets/league-levels";
import { DistrictSwitcher } from "@/components/district-switcher";
import { ClearDayButton } from "@/components/league-clear-day-button";
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
  handicap_district_id: string | null;
  handicap: HandicapDistrict | null;
};

const NO_HANDICAP = "__none__";

// Who gets how many points per frame, from the district's handicap table
// and the two players' 12 ft levels. null when there's nothing to show.
function handicapText(
  handicap: HandicapDistrict | null,
  levelA: string | null | undefined,
  levelB: string | null | undefined,
  nameA: string,
  nameB: string,
): string | null {
  if (!handicap) return null;
  if (!levelA || !levelB) return "פור: חסרה דרגה לאחד השחקנים";
  const a = handicap.values[levelA];
  const b = handicap.values[levelB];
  if (a === undefined || b === undefined) {
    const missing = a === undefined ? levelA : levelB;
    return `פור: אין מספר לדרגה ${missing} בטבלה של ${handicap.name}`;
  }
  if (a === b) return "ללא פור";
  return a > b ? `${nameA} מקבל ${a - b} נק׳ לפריים` : `${nameB} מקבל ${b - a} נק׳ לפריים`;
}

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
  // null = not picked by hand: follows the handicap table with the same name.
  const [newHandicap, setNewHandicap] = useState<string | null>(null);

  const { data: handicapData } = useQuery({
    queryKey: ["settings", "handicap"],
    queryFn: async () => {
      const r = await fetch("/api/settings/handicap");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: HandicapDistrict[] };
    },
    enabled: canEdit,
  });
  const handicapTables = handicapData?.districts ?? [];
  const autoHandicap = handicapTables.find((h) => h.name === newLabel.trim())?.id ?? NO_HANDICAP;
  const chosenHandicap = newHandicap ?? autoHandicap;

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
        body: JSON.stringify({
          label,
          numCycles,
          handicapDistrictId: chosenHandicap === NO_HANDICAP ? null : chosenHandicap,
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המחוז נוסף");
      setNewLabel("");
      setNewNumCycles("1");
      setNewHandicap(null);
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

  const handicapMut = useMutation({
    mutationFn: async ({ districtId, handicapDistrictId }: { districtId: string; handicapDistrictId: string | null }) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ districtId, handicapDistrictId }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: () => toast.error("שגיאה בשמירת טבלת הפור"),
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
    mutationFn: async (assignments: { matchId: string; date: string | null }[]) => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
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
          <div className="w-36">
            <label className="text-xs text-muted-foreground mb-1 block">טבלת פור</label>
            <Select value={chosenHandicap} onValueChange={(v) => setNewHandicap(v ?? NO_HANDICAP)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="ללא" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HANDICAP}>ללא</SelectItem>
                {handicapTables.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          // Matches by when they're played (the weekly schedule), not by round.
          const datedDays = [
            ...new Set(district.matches.filter((m) => m.scheduled_date).map((m) => m.scheduled_date as string)),
          ].sort();
          const playedNoDate = district.matches.filter((m) => !m.scheduled_date && m.frames_a !== null);
          const unscheduled = district.matches.filter((m) => !m.scheduled_date && m.frames_a === null);
          const groups: { key: string; title: string; matches: DistrictMatch[] }[] = [
            ...datedDays.map((day) => ({
              key: day,
              title: `${dayLabelHe(day)} · ${shortDate(day)}`,
              matches: district.matches.filter((m) => m.scheduled_date === day),
            })),
            ...(playedNoDate.length ? [{ key: "played", title: "שוחקו (ללא תאריך)", matches: playedNoDate }] : []),
            ...(unscheduled.length
              ? [{ key: "open", title: `עוד לא שובצו (${unscheduled.length})`, matches: unscheduled }]
              : []),
          ];
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
                  {canEdit ? (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <span>טבלת פור:</span>
                      <Select
                        value={district.handicap_district_id ?? NO_HANDICAP}
                        onValueChange={(v) =>
                          handicapMut.mutate({
                            districtId: district.id,
                            handicapDistrictId: !v || v === NO_HANDICAP ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue placeholder="ללא" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_HANDICAP}>ללא</SelectItem>
                          {handicapTables.map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    district.handicap && (
                      <p className="text-xs text-muted-foreground">טבלת פור: {district.handicap.name}</p>
                    )
                  )}
                </div>
                {/* Matches are created automatically when players join the
                    district; this only covers a district filled before that. */}
                {canEdit && !hasFixtures && district.memberIds.length >= 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generateMut.isPending}
                    onClick={() => generateMut.mutate(district.id)}
                  >
                    צור משחקים
                  </Button>
                )}
              </div>

              <LeagueStandingsTable
                rows={standings}
                renderName={participantName}
                levels={levelsByParticipant}
                remaining={remainingMatchesByParticipant(district.matches)}
              />

              {hasFixtures && (
                <div className="flex flex-col gap-3 px-4 py-3 border-t border-border/40">
                  {groups.map((group) => (
                    <div key={group.key} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{group.title}</p>
                        {canEdit && /^\d{4}-\d{2}-\d{2}$/.test(group.key) && (
                          <ClearDayButton
                            day={group.key}
                            matches={group.matches}
                            busy={scheduleMut.isPending}
                            onClear={(ids) =>
                              scheduleMut.mutate(
                                ids.map((matchId) => ({ matchId, date: null })),
                                { onSuccess: () => toast.success(`בוטל שיבוץ של ${ids.length} משחקים`) },
                              )
                            }
                          />
                        )}
                      </div>
                      {group.matches
                        .map((m) => {
                          const nameA = participantName(m.participant_a_id);
                          const nameB = participantName(m.participant_b_id);
                          return (
                            <MatchRow
                              key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                              nameA={nameA}
                              nameB={nameB}
                              handicap={
                                m.frames_a === null
                                  ? handicapText(
                                      district.handicap,
                                      levelsByParticipant[m.participant_a_id]?.level,
                                      levelsByParticipant[m.participant_b_id]?.level,
                                      nameA,
                                      nameB,
                                    )
                                  : null
                              }
                              match={m}
                              canEdit={canEdit}
                              onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                              saving={resultMut.isPending}
                              onSchedule={(date) => scheduleMut.mutate([{ matchId: m.id, date }])}
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
  handicap,
  match,
  canEdit,
  onSave,
  saving,
  onSchedule,
}: {
  nameA: string;
  nameB: string;
  handicap: string | null;
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
      {handicap && <p className="text-[11px] text-primary">{handicap}</p>}
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
