"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Swords, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { knockoutRoundCount, knockoutRoundLabel, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type KnockoutMatch = {
  id: string;
  round: number;
  slot: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
  next_match_id: string | null;
};

const BRACKET_SIZES = [4, 8, 16, 32];

export function TournamentKnockoutView({
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
  const [bracketSize, setBracketSize] = useState("8");

  const { data, isLoading } = useQuery({
    queryKey: ["tournament-knockout", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { matches: KnockoutMatch[]; hasAnyResult: boolean };
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bracketSize: Number(bracketSize) }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => {
      toast.success("הבראקט נוצר");
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה ביצירת הבראקט"),
  });

  const assignMut = useMutation({
    mutationFn: async ({ matchId, side, participantId }: { matchId: string; side: "a" | "b"; participantId: string | null }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/matches/${matchId}/assign`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side, participantId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשיבוץ"),
  });

  const finalizeByesMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/finalize-byes`, { method: "POST" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("השיבוץ הסתיים");
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
    },
    onError: () => toast.error("שגיאה בסיום השיבוץ"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/matches/${matchId}/result`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת התוצאה"),
  });

  function handleCreate() {
    if (data?.hasAnyResult) {
      if (!window.confirm("כבר יש תוצאות בבראקט הקיים — יצירה מחדש תמחק אותן. להמשיך?")) return;
    }
    createMut.mutate();
  }

  function participantName(id: string | null) {
    if (!id) return null;
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  function participantRating(id: string | null) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  const matches = data?.matches ?? [];
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => ({
    round,
    label: knockoutRoundLabel(round, totalRounds),
    matches: matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot),
  }));

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {matches.length === 0 ? "בניית בראקט נוקאאוט" : "בניית בראקט מחדש"}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={bracketSize} onValueChange={(v) => v && setBracketSize(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRACKET_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s} משבצות</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              <Swords size={14} className="ml-1.5" />
              {createMut.isPending ? "יוצר..." : matches.length === 0 ? "צור בראקט" : "צור מחדש"}
            </Button>
          </div>
          {matches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => finalizeByesMut.mutate()}
              disabled={finalizeByesMut.isPending}
            >
              <CheckCheck size={14} className="ml-1.5" />
              {finalizeByesMut.isPending ? "מסיים..." : "סיים שיבוץ"}
            </Button>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין לא נוצר בראקט
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {rounds.map(({ round, label, matches: roundMatches }) => (
              <div key={round} className="flex flex-col gap-2 w-56 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                  {label}
                </p>
                {roundMatches.map((m) => {
                  const nameA = participantName(m.participant_a_id);
                  const nameB = participantName(m.participant_b_id);
                  const handicap =
                    nameA && nameB
                      ? formatHandicapLabel(
                          nameA,
                          participantRating(m.participant_a_id),
                          nameB,
                          participantRating(m.participant_b_id),
                          handicapPointsPerRatingGap,
                        )
                      : "";
                  return (
                    <KnockoutMatchCard
                      key={`${m.id}:${m.participant_a_id ?? ""}:${m.participant_b_id ?? ""}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                      match={m}
                      round={round}
                      nameA={nameA}
                      nameB={nameB}
                      handicap={handicap}
                      canEdit={canEdit}
                      participants={participants}
                      onAssign={(side, participantId) => assignMut.mutate({ matchId: m.id, side, participantId })}
                      onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                      saving={resultMut.isPending}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnockoutMatchCard({
  match,
  round,
  nameA,
  nameB,
  handicap,
  canEdit,
  participants,
  onAssign,
  onSave,
  saving,
}: {
  match: KnockoutMatch;
  round: number;
  nameA: string | null;
  nameB: string | null;
  handicap: string;
  canEdit: boolean;
  participants: Participant[];
  onAssign: (side: "a" | "b", participantId: string | null) => void;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;
  const canAssign = canEdit && round === 1 && !played;
  const canEnterResult = canEdit && !played && !!match.participant_a_id && !!match.participant_b_id;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-2.5 flex flex-col gap-1.5">
      {(["a", "b"] as const).map((side) => {
        const name = side === "a" ? nameA : nameB;
        const participantId = side === "a" ? match.participant_a_id : match.participant_b_id;
        const score = side === "a" ? match.frames_a : match.frames_b;
        return (
          <div key={side} className="flex items-center gap-2 text-sm">
            {canAssign ? (
              <Select
                value={participantId ?? "__none__"}
                onValueChange={(v) => onAssign(side, !v || v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="בחר משתתף..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ריק —</SelectItem>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex-1 truncate">{name ?? "TBD"}</span>
            )}
            {played && <span className="font-medium tabular-nums">{score}</span>}
          </div>
        );
      })}

      {canEnterResult && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 mt-0.5">
          <Input
            type="number"
            min={0}
            value={framesA}
            onChange={(e) => setFramesA(e.target.value)}
            className="h-7 w-12 text-center px-1 text-xs"
          />
          <span className="text-muted-foreground text-xs">-</span>
          <Input
            type="number"
            min={0}
            value={framesB}
            onChange={(e) => setFramesB(e.target.value)}
            className="h-7 w-12 text-center px-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            disabled={saving || framesA === "" || framesB === ""}
            onClick={() => onSave(Number(framesA), Number(framesB))}
          >
            שמור
          </Button>
        </div>
      )}

      {handicap && !played && <p className="text-[10px] text-muted-foreground pt-0.5">{handicap}</p>}
    </div>
  );
}
