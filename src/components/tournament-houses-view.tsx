"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shuffle, Trash2, ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeHouseStandings } from "@/lib/sheets/tournament-logic";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; skill_level: string | null };
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
  canEdit,
}: {
  tournamentId: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [numHouses, setNumHouses] = useState("2");
  const [movingParticipantId, setMovingParticipantId] = useState<string | null>(null);
  const [collapsedHouseIds, setCollapsedHouseIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(houseId: string) {
    setCollapsedHouseIds((prev) => {
      const next = new Set(prev);
      if (next.has(houseId)) next.delete(houseId);
      else next.add(houseId);
      return next;
    });
  }

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

  const deleteDrawMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("ההגרלה נמחקה");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה במחיקת ההגרלה"),
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
      setMovingParticipantId(null);
    },
    onError: () => toast.error("שגיאה בהעברה"),
  });

  function handleDraw() {
    if (data?.hasAnyResult) {
      if (!window.confirm("כבר יש תוצאות בבתים הקיימים — הגרלה מחדש תמחק אותם. להמשיך?")) return;
    }
    drawMut.mutate();
  }

  function handleDeleteDraw() {
    const warning = data?.hasAnyResult
      ? "כבר יש תוצאות בבתים הקיימים — המחיקה תמחק גם אותן. להמשיך?"
      : "למחוק את ההגרלה הקיימת?";
    if (!window.confirm(warning)) return;
    deleteDrawMut.mutate();
  }

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  function participantSkillLevel(id: string) {
    return participants.find((x) => x.id === id)?.student.skill_level ?? null;
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
            {houses.length > 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteDraw}
                disabled={deleteDrawMut.isPending}
              >
                <Trash2 size={14} className="ml-1.5" />
                מחק הגרלה
              </Button>
            )}
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
          const collapsed = collapsedHouseIds.has(house.id);
          return (
            <div key={house.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCollapsed(house.id)}
                className="w-full flex items-center justify-between px-4 pt-3 pb-2 text-right"
              >
                <span className="text-sm font-semibold">{house.label}</span>
                {collapsed ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronUp size={16} className="text-muted-foreground" />
                )}
              </button>

              {!collapsed && (
              <>
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
                      {canEdit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                        <td className="px-4 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          {participantName(row.participantId)}
                          {participantSkillLevel(row.participantId) && (
                            <span className="text-muted-foreground"> ({participantSkillLevel(row.participantId)})</span>
                          )}
                        </td>
                        <td className="text-center px-2 py-1.5">{row.wins}</td>
                        <td className="text-center px-2 py-1.5">{row.framesWon}</td>
                        <td className="text-center px-2 py-1.5">{row.framesLost}</td>
                        <td className="text-center px-2 py-1.5">
                          {row.framesWon - row.framesLost > 0 ? "+" : ""}
                          {row.framesWon - row.framesLost}
                        </td>
                        {canEdit && (
                          <td className="px-2 py-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setMovingParticipantId(row.participantId)}
                            >
                              <ArrowLeftRight size={14} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3 border-t border-border/40">
                {house.matches.map((m) => {
                  const nameA = participantName(m.participant_a_id);
                  const nameB = participantName(m.participant_b_id);
                  return (
                    <HouseMatchRow
                      key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                      nameA={nameA}
                      nameB={nameB}
                      match={m}
                      canEdit={canEdit}
                      onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                      saving={resultMut.isPending}
                    />
                  );
                })}
              </div>
              </>
              )}
            </div>
          );
        })
      )}

      <Dialog open={!!movingParticipantId} onOpenChange={(v) => !v && setMovingParticipantId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movingParticipantId ? `העבר את ${participantName(movingParticipantId)} לבית` : "העבר לבית"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {houses
              .filter((h) => !h.memberIds.includes(movingParticipantId ?? ""))
              .map((h) => (
                <Button
                  key={h.id}
                  variant="outline"
                  className="justify-start h-11"
                  disabled={moveMut.isPending}
                  onClick={() => movingParticipantId && moveMut.mutate({ participantId: movingParticipantId, houseId: h.id })}
                >
                  {h.label}
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HouseMatchRow({
  nameA,
  nameB,
  match,
  canEdit,
  onSave,
  saving,
}: {
  nameA: string;
  nameB: string;
  match: HouseMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const [manual, setManual] = useState(false);
  const played = match.frames_a !== null && match.frames_b !== null;
  // The parent keys this component by match id + frames, so a saved result
  // remounts it fresh — this lazy initializer correctly starts collapsed
  // (clean result view) for an already-played match and open for a new one.
  const [editing, setEditing] = useState(!played);

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

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">{nameA} נגד {nameB}</span>
        {played ? (
          <span className="font-medium">{match.frames_a} - {match.frames_b}</span>
        ) : (
          <span className="text-muted-foreground text-xs">טרם שוחק</span>
        )}
      </div>
    );
  }

  if (played && !editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm">
        <span className="truncate">
          <span className={cn(match.frames_a! > match.frames_b! && "font-semibold")}>{nameA}</span>
          <span className="mx-1.5 font-semibold tabular-nums">{match.frames_a} - {match.frames_b}</span>
          <span className={cn(match.frames_b! > match.frames_a! && "font-semibold")}>{nameB}</span>
        </span>
        <button
          type="button"
          className="text-xs text-muted-foreground underline shrink-0"
          onClick={() => setEditing(true)}
        >
          עריכה
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">{nameA} נגד {nameB}</span>
      </div>

      {!manual && (
        <div className="flex flex-col gap-1">
          {/* One-click common best-of-3 results instead of typing into two
              boxes every time — "תוצאה אחרת" below still covers anything
              else. */}
          <div className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-xs text-muted-foreground">{nameA}</span>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={saving} onClick={() => onSave(2, 0)}>2-0</Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={saving} onClick={() => onSave(2, 1)}>2-1</Button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-xs text-muted-foreground">{nameB}</span>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={saving} onClick={() => onSave(1, 2)}>2-1</Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={saving} onClick={() => onSave(0, 2)}>2-0</Button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setManual(true)}>
              תוצאה אחרת
            </button>
            {played && (
              <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => setEditing(false)}>
                ביטול
              </button>
            )}
          </div>
        </div>
      )}

      {manual && (
        <div className="flex items-center gap-1.5">
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
            disabled={saving || framesA.trim() === "" || framesB.trim() === ""}
            onClick={save}
          >
            שמור
          </Button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline"
            onClick={() => setManual(false)}
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}
