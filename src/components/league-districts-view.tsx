"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
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
};

type DistrictWithMatches = {
  id: string;
  league_id: string;
  label: string;
  matches: DistrictMatch[];
  memberIds: string[];
};

export function LeagueDistrictsView({
  leagueId,
  participants,
  handicapPointsPerRatingGap,
  canEdit,
}: {
  leagueId: string;
  participants: Participant[];
  handicapPointsPerRatingGap: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["league-districts", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: DistrictWithMatches[] };
    },
  });

  const addDistrictMut = useMutation({
    mutationFn: async (label: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המחוז נוסף");
      setNewLabel("");
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

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }
  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
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
          <Button onClick={() => addDistrictMut.mutate(newLabel.trim())} disabled={!newLabel.trim() || addDistrictMut.isPending}>
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
        districts.map((district) => {
          const standings = computeHouseStandings(district.memberIds, district.matches);
          const hasFixtures = district.matches.length > 0;
          const hasResults = district.matches.some((m) => m.frames_a !== null);
          const rounds = [...new Set(district.matches.map((m) => m.round))].sort((a, b) => a - b);
          return (
            <div key={district.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-sm font-semibold">{district.label}</p>
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

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/40">
                      <th className="text-right px-4 py-1.5 font-medium">מקום</th>
                      <th className="text-right px-2 py-1.5 font-medium">שם</th>
                      <th className="text-center px-2 py-1.5 font-medium">נצחונות</th>
                      <th className="text-center px-2 py-1.5 font-medium">פריימים לטובה</th>
                      <th className="text-center px-2 py-1.5 font-medium">פריימים לרעה</th>
                      <th className="text-center px-2 py-1.5 font-medium">הפרש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                        <td className="px-4 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5">{participantName(row.participantId)}</td>
                        <td className="text-center px-2 py-1.5">{row.wins}</td>
                        <td className="text-center px-2 py-1.5">{row.framesWon}</td>
                        <td className="text-center px-2 py-1.5">{row.framesLost}</td>
                        <td className="text-center px-2 py-1.5">
                          {row.framesWon - row.framesLost > 0 ? "+" : ""}
                          {row.framesWon - row.framesLost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                          const handicap = formatHandicapLabel(
                            nameA,
                            participantRating(m.participant_a_id),
                            nameB,
                            participantRating(m.participant_b_id),
                            handicapPointsPerRatingGap,
                          );
                          return (
                            <MatchRow
                              key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                              nameA={nameA}
                              nameB={nameB}
                              handicap={handicap}
                              match={m}
                              canEdit={canEdit}
                              onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                              saving={resultMut.isPending}
                            />
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
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
}: {
  nameA: string;
  nameB: string;
  handicap: string;
  match: DistrictMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

  function save() {
    const a = framesA.trim();
    const b = framesB.trim();
    const na = Number(a);
    const nb = Number(b);
    // Number("") and Number(" ") both coerce to 0 — trim + explicit
    // emptiness + Number.isInteger together are required to reject a
    // whitespace-only input instead of silently recording a 0 result.
    if (a === "" || b === "" || !Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) {
      toast.error("יש להזין תוצאה תקינה");
      return;
    }
    onSave(na, nb);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">{nameA} נגד {nameB}</span>
        {canEdit ? (
          <>
            <Input type="number" min={0} value={framesA} onChange={(e) => setFramesA(e.target.value)} className="h-7 w-14 text-center px-1" />
            <span className="text-muted-foreground">-</span>
            <Input type="number" min={0} value={framesB} onChange={(e) => setFramesB(e.target.value)} className="h-7 w-14 text-center px-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={saving || framesA.trim() === "" || framesB.trim() === ""}
              onClick={save}
            >
              שמור
            </Button>
          </>
        ) : played ? (
          <span className="font-medium">{match.frames_a} - {match.frames_b}</span>
        ) : (
          <span className="text-muted-foreground text-xs">טרם שוחק</span>
        )}
      </div>
      {handicap && !played && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
    </div>
  );
}
