"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type HouseMatch = {
  id: string;
  house_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};

type HouseWithMatches = {
  id: string;
  tournament_id: string;
  label: string;
  matches: HouseMatch[];
  memberIds: string[];
};

export function TournamentHousesView({
  tournamentId,
  participants,
  handicapPointsPerRatingGap,
  canEdit,
}: {
  tournamentId: string;
  participants: Participant[];
  handicapPointsPerRatingGap: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [numHouses, setNumHouses] = useState("2");

  const { data, isLoading } = useQuery({
    queryKey: ["tournament-houses", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { houses: HouseWithMatches[]; hasAnyResult: boolean };
    },
  });

  const drawMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/draw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numHouses: Number(numHouses) }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("ההגרלה בוצעה");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהגרלה"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] }),
    onError: () => toast.error("שגיאה בשמירת התוצאה"),
  });

  const moveMut = useMutation({
    mutationFn: async ({ participantId, houseId }: { participantId: string; houseId: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("השחקן הועבר");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהעברה"),
  });

  function handleDraw() {
    if (data?.hasAnyResult) {
      if (!window.confirm("כבר יש תוצאות בבתים הקיימים — הגרלה מחדש תמחק אותם. להמשיך?")) return;
    }
    drawMut.mutate();
  }

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  const houses = data?.houses ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {houses.length === 0 ? "הגרלת בתים" : "הגרלה מחדש"}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">מספר בתים</Label>
              <Input type="number" min={1} value={numHouses} onChange={(e) => setNumHouses(e.target.value)} />
            </div>
            <Button onClick={handleDraw} disabled={drawMut.isPending || !Number(numHouses)}>
              <Shuffle size={14} className="ml-1.5" />
              {drawMut.isPending ? "מגריל..." : houses.length === 0 ? "בצע הגרלה" : "הגרל מחדש"}
            </Button>
          </div>
        </div>
      )}

      {houses.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין לא בוצעה הגרלה
        </div>
      ) : (
        houses.map((house) => {
          const standings = computeHouseStandings(house.memberIds, house.matches);
          return (
            <div key={house.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <p className="text-sm font-semibold px-4 pt-3 pb-2">{house.label}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/40">
                      <th className="text-right px-4 py-1.5 font-medium">מקום</th>
                      <th className="text-right px-2 py-1.5 font-medium">שם</th>
                      <th className="text-center px-2 py-1.5 font-medium">נצחונות</th>
                      <th className="text-center px-2 py-1.5 font-medium">פרשים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                        <td className="px-4 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          {participantName(row.participantId)}
                          {canEdit && (
                            <Select
                              value={house.id}
                              onValueChange={(v) => v && moveMut.mutate({ participantId: row.participantId, houseId: v })}
                            >
                              <SelectTrigger className="h-6 w-24 text-[10px] mr-2 inline-flex">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {houses.map((h) => (
                                  <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="text-center px-2 py-1.5">{row.wins}</td>
                        <td className="text-center px-2 py-1.5">{row.framesWon}-{row.framesLost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3 border-t border-border/40">
                {house.matches.map((m) => {
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
                    <HouseMatchRow
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
            </div>
          );
        })
      )}
    </div>
  );
}

function HouseMatchRow({
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
  match: HouseMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

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
              className="h-7 w-14 text-center px-1"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              value={framesB}
              onChange={(e) => setFramesB(e.target.value)}
              className="h-7 w-14 text-center px-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={saving || framesA === "" || framesB === ""}
              onClick={() => onSave(Number(framesA), Number(framesB))}
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
      {handicap && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
    </div>
  );
}
