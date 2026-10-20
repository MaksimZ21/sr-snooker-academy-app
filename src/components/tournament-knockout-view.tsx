"use client";
import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Swords, CheckCheck, Trash2 } from "lucide-react";
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
import { knockoutRoundLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string };
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

type KnockoutQueryData = { matches: KnockoutMatch[]; hasAnyResult: boolean };

export function TournamentKnockoutView({
  tournamentId,
  participants,
  canEdit,
}: {
  tournamentId: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [bracketSize, setBracketSize] = useState("8");

  const { data, isLoading } = useQuery({
    queryKey: ["tournament-knockout", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as KnockoutQueryData;
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
    // Optimistic — otherwise the picked name only appears after the full
    // round trip, which felt like a multi-second delay before the slot
    // reflected the pick.
    onMutate: async ({ matchId, side, participantId }) => {
      await qc.cancelQueries({ queryKey: ["tournament-knockout", tournamentId] });
      const previous = qc.getQueryData<KnockoutQueryData>(["tournament-knockout", tournamentId]);
      const column = side === "a" ? "participant_a_id" : "participant_b_id";
      qc.setQueryData<KnockoutQueryData>(["tournament-knockout", tournamentId], (old) =>
        old
          ? { ...old, matches: old.matches.map((m) => (m.id === matchId ? { ...m, [column]: participantId } : m)) }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tournament-knockout", tournamentId], ctx.previous);
      toast.error(e instanceof Error ? e.message : "שגיאה בשיבוץ");
    },
  });

  const deleteBracketMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הבראקט אופס");
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
    },
    onError: () => toast.error("שגיאה באיפוס הבראקט"),
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

  function handleReset() {
    const warning = data?.hasAnyResult
      ? "כבר יש תוצאות בבראקט הקיים — האיפוס ימחק גם אותן. להמשיך?"
      : "לאפס את הבראקט הקיים?";
    if (!window.confirm(warning)) return;
    deleteBracketMut.mutate();
  }

  function participantName(id: string | null) {
    if (!id) return null;
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  const matches = data?.matches ?? [];
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => ({
    round,
    label: knockoutRoundLabel(round, totalRounds),
    matches: matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot),
  }));
  const assignedInRound1 = new Set(
    matches
      .filter((m) => m.round === 1)
      .flatMap((m) => [m.participant_a_id, m.participant_b_id])
      .filter((id): id is string => id !== null),
  );

  // Draws the actual connecting lines between a match and the one its
  // winner feeds into. Measured from real rendered positions (not computed
  // from a fixed card height/gap) so it stays correct regardless of how
  // tall a card ends up — a name wrapping to two lines, the score-entry
  // row appearing, etc. — without needing pixel-perfect CSS spacing math.
  const bracketRef = useRef<HTMLDivElement>(null);
  const matchNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<{ id: string; d: string }[]>([]);

  const recomputeConnectors = useCallback(() => {
    const container = bracketRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next: { id: string; d: string }[] = [];
    for (const m of matches) {
      if (!m.next_match_id) continue;
      const fromEl = matchNodeRefs.current.get(m.id);
      const toEl = matchNodeRefs.current.get(m.next_match_id);
      if (!fromEl || !toEl) continue;
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      // RTL layout: round 1 is rendered on the right, later rounds to its
      // left — a match's own left edge faces the match it feeds into.
      const x1 = fromRect.left - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.right - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;
      const midX = (x1 + x2) / 2;
      next.push({ id: m.id, d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}` });
    }
    setConnectors(next);
  }, [matches]);

  useLayoutEffect(() => {
    recomputeConnectors();
    window.addEventListener("resize", recomputeConnectors);
    return () => window.removeEventListener("resize", recomputeConnectors);
  }, [recomputeConnectors]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => finalizeByesMut.mutate()}
                disabled={finalizeByesMut.isPending}
              >
                <CheckCheck size={14} className="ml-1.5" />
                {finalizeByesMut.isPending ? "מסיים..." : "סיים שיבוץ"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleReset}
                disabled={deleteBracketMut.isPending}
              >
                <Trash2 size={14} className="ml-1.5" />
                אפס בראקט
              </Button>
            </div>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין לא נוצר בראקט
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div ref={bracketRef} className="relative flex gap-10 min-w-max">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
              {connectors.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={2}
                />
              ))}
            </svg>
            {rounds.map(({ round, label, matches: roundMatches }) => (
              <div key={round} className="relative flex flex-col w-56 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center pb-2">
                  {label}
                </p>
                <div className="flex-1 flex flex-col justify-around gap-6">
                  {roundMatches.map((m) => {
                    const nameA = participantName(m.participant_a_id);
                    const nameB = participantName(m.participant_b_id);
                    return (
                      <div
                        key={`${m.id}:${m.participant_a_id ?? ""}:${m.participant_b_id ?? ""}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                        ref={(el) => {
                          if (el) matchNodeRefs.current.set(m.id, el);
                          else matchNodeRefs.current.delete(m.id);
                        }}
                      >
                        <KnockoutMatchCard
                          match={m}
                          round={round}
                          nameA={nameA}
                          nameB={nameB}
                          canEdit={canEdit}
                          participants={participants}
                          assignedInRound1={assignedInRound1}
                          onAssign={(side, participantId) => assignMut.mutate({ matchId: m.id, side, participantId })}
                          onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                          saving={resultMut.isPending}
                        />
                      </div>
                    );
                  })}
                </div>
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
  canEdit,
  participants,
  assignedInRound1,
  onAssign,
  onSave,
  saving,
}: {
  match: KnockoutMatch;
  round: number;
  nameA: string | null;
  nameB: string | null;
  canEdit: boolean;
  participants: Participant[];
  assignedInRound1: Set<string>;
  onAssign: (side: "a" | "b", participantId: string | null) => void;
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
                <SelectTrigger className="h-7 flex-1 text-xs">
                  {/* SelectValue shows the raw value, not the matching
                      SelectItem's children, unless Select is given an
                      `items` map — map it back to a name ourselves. */}
                  <SelectValue placeholder="בחר משתתף...">
                    {(v: string) => {
                      if (v === "__none__") return "— ריק —";
                      const p = participants.find((x) => x.id === v);
                      return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : v;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ריק —</SelectItem>
                  {participants
                    .filter((p) => p.id === participantId || !assignedInRound1.has(p.id))
                    .map((p) => (
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
            disabled={saving || framesA.trim() === "" || framesB.trim() === ""}
            onClick={save}
          >
            שמור
          </Button>
        </div>
      )}
    </div>
  );
}
