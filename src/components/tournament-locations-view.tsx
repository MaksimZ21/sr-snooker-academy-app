"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ClearResultButton } from "@/components/clear-result-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatchLine } from "@/components/match-line";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  location_id: string | null;
  house_id: string | null;
  student: { first_name: string; last_name: string; rating: number };
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

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
  location_id: string | null;
  matches: HouseMatch[];
  memberIds: string[];
};

export function TournamentLocationsView({
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
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newHouseLabels, setNewHouseLabels] = useState<Record<string, string>>({});
  // Per house: the names typed/pasted to add straight into it (open = key present).
  const [houseNames, setHouseNames] = useState<Record<string, string>>({});
  // One location at a time, picked with its button.
  const [locationId, setLocationId] = useState<string | null>(null);
  // Houses folded away by the admin, like the regular tournament's houses.
  const [collapsedHouseIds, setCollapsedHouseIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(houseId: string) {
    setCollapsedHouseIds((prev) => {
      const next = new Set(prev);
      if (next.has(houseId)) next.delete(houseId);
      else next.add(houseId);
      return next;
    });
  }

  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ["tournament-locations", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { locations: TournamentLocation[] };
    },
  });

  const { data: housesData, isLoading: housesLoading } = useQuery({
    queryKey: ["tournament-houses", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { houses: HouseWithMatches[]; hasAnyResult: boolean };
    },
  });

  const addLocationMut = useMutation({
    mutationFn: async (label: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המיקום נוסף");
      setNewLocationLabel("");
      qc.invalidateQueries({ queryKey: ["tournament-locations", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת מיקום"),
  });

  const addHouseMut = useMutation({
    mutationFn: async ({ locationId, label }: { locationId: string; label: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations/${locationId}/houses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: (_data, { locationId }) => {
      toast.success("הבית נוסף");
      setNewHouseLabels((prev) => ({ ...prev, [locationId]: "" }));
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת בית"),
  });

  const assignHouseMut = useMutation({
    mutationFn: async ({ participantId, houseId }: { participantId: string; houseId: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("השחקן שובץ לבית");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיבוץ לבית"),
  });

  const removeFromHouseMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("השחקן הוסר מהבית");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בהסרה מהבית"),
  });

  const addToHouseMut = useMutation({
    mutationFn: async ({ houseId, names }: { houseId: string; names: string[] }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ localNames: names, houseId }),
      });
      const body = (await r.json().catch(() => null)) as { added?: number; skipped?: number; error?: string } | null;
      if (!r.ok) throw new Error(body?.error ?? "שגיאה בהוספה לבית");
      return { added: body?.added ?? 0, skipped: body?.skipped ?? 0 };
    },
    onSuccess: ({ added, skipped }, { houseId }) => {
      toast.success(skipped ? `נוספו ${added} שחקנים לבית (${skipped} כבר בטורניר)` : `נוספו ${added} שחקנים לבית`);
      setHouseNames((prev) => ({ ...prev, [houseId]: "" }));
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהוספה לבית"),
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

  const clearMut = useMutation({
    mutationFn: async (matchId: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/matches/${matchId}`, { method: "DELETE" });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה במחיקת התוצאה");
      }
    },
    onSuccess: () => {
      toast.success("התוצאה נמחקה");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה במחיקת התוצאה"),
  });

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }
  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (locationsLoading || housesLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  const locations = locationsData?.locations ?? [];
  const houses = housesData?.houses ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-[18px] border bg-card p-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">מיקום חדש</label>
            <Input value={newLocationLabel} onChange={(e) => setNewLocationLabel(e.target.value)} placeholder="למשל: אולם צפון" dir="auto" />
          </div>
          <Button onClick={() => addLocationMut.mutate(newLocationLabel.trim())} disabled={!newLocationLabel.trim() || addLocationMut.isPending}>
            <Plus size={14} className="ml-1.5" />
            הוסף מיקום
          </Button>
        </div>
      )}

      {locations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-[18px] border bg-card">
          עדיין אין מיקומים
        </div>
      ) : (
        (() => {
          const selected = locations.find((l) => l.id === locationId) ?? locations[0];
          return (
            <>
              {locations.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
                  {locations.map((l) => {
                    const count = participants.filter((p) => p.location_id === l.id).length;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLocationId(l.id)}
                        aria-pressed={l.id === selected.id}
                        className={cn(
                          "shrink-0 rounded-xl px-4 py-2 font-display text-sm font-bold transition-colors",
                          l.id === selected.id
                            ? "bg-sidebar text-white"
                            : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {l.label} <span className="tabular-nums opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {[selected].map((location) => {
          const locationHouses = houses.filter((h) => h.location_id === location.id);
          const unassigned = participants.filter((p) => p.location_id === location.id && !p.house_id);
          const locationMatches = locationHouses.flatMap((h) => h.matches);
          const locationPlayed = locationMatches.filter((m) => m.frames_a !== null && m.frames_b !== null).length;
          return (
            <div key={location.id} className="rounded-[18px] border bg-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 bg-sidebar text-white">
                <span className="bc-num text-2xl leading-none">{location.label}</span>
                <span className="flex flex-wrap items-center gap-1.5 font-display text-[11px] font-bold">
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5">{locationHouses.length} בתים</span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5">
                    {participants.filter((p) => p.location_id === location.id).length} שחקנים
                  </span>
                  {locationMatches.length > 0 && (
                    <span className="rounded-md bg-primary px-1.5 py-0.5">
                      {locationPlayed}/{locationMatches.length} משחקים
                    </span>
                  )}
                </span>
              </div>

              {canEdit && (
                <div className="flex items-end gap-2 px-4 py-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">בית חדש</label>
                    <Input
                      value={newHouseLabels[location.id] ?? ""}
                      onChange={(e) => setNewHouseLabels((prev) => ({ ...prev, [location.id]: e.target.value }))}
                      placeholder="למשל: בית מתקדמים"
                      dir="auto"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addHouseMut.mutate({ locationId: location.id, label: (newHouseLabels[location.id] ?? "").trim() })}
                    disabled={!(newHouseLabels[location.id] ?? "").trim() || addHouseMut.isPending}
                  >
                    <Plus size={14} className="ml-1.5" />
                    הוסף בית
                  </Button>
                </div>
              )}

              {unassigned.length > 0 && (
                <div className="flex flex-col gap-2 px-4 py-3 border-t bg-amber-500/8">
                  <p className="flex items-center gap-2 font-display text-sm font-extrabold text-amber-700 dark:text-amber-400">
                    לא משוייכים לבית
                    <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] text-white tabular-nums">{unassigned.length}</span>
                  </p>
                  {unassigned.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 text-sm">
                      <span className="w-8 h-8 rounded-lg bg-sidebar text-[#7ee2a4] flex items-center justify-center font-display text-[11px] font-extrabold shrink-0">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).map((w) => w[0]).join("").slice(0, 2)}
                      </span>
                      <span className="flex-1 truncate font-semibold">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                      </span>
                      {canEdit && locationHouses.length > 0 && (
                        <Select
                          key={`${p.id}-${assignHouseMut.variables?.participantId === p.id ? assignHouseMut.failureCount : 0}`}
                          onValueChange={(v: string | null) => v && assignHouseMut.mutate({ participantId: p.id, houseId: v })}
                        >
                          <SelectTrigger className="h-9 w-32 text-xs font-display font-bold bg-card">
                            <SelectValue placeholder="שבץ לבית..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locationHouses.map((h) => (
                              <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {locationHouses.length > 0 && (
              <div className="flex items-start gap-3 overflow-x-auto snap-x snap-mandatory p-3 border-t bg-muted/30">
              {locationHouses.map((house) => {
                const standings = computeHouseStandings(house.memberIds, house.matches);
                const collapsed = collapsedHouseIds.has(house.id);
                return (
                  <div
                    key={house.id}
                    className="snap-start shrink-0 w-[90%] sm:w-[440px] rounded-[14px] border bg-card overflow-hidden shadow-[0_6px_16px_-12px_rgb(13_21_16/0.35)]"
                  >
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-sidebar text-white">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(house.id)}
                        aria-expanded={!collapsed}
                        className="flex flex-1 items-center gap-2 min-w-0 text-right"
                      >
                        <span className="bc-num text-lg leading-none truncate">{house.label}</span>
                        <span className="font-display text-[11px] font-bold text-white/60 shrink-0">
                          {house.matches.filter((m) => m.frames_a !== null && m.frames_b !== null).length}/{house.matches.length} משחקים
                        </span>
                        {collapsed ? (
                          <ChevronDown size={16} className="shrink-0 text-white/60" />
                        ) : (
                          <ChevronUp size={16} className="shrink-0 text-white/60" />
                        )}
                      </button>
                      {canEdit && !collapsed && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md bg-white/10 px-2 py-1 font-display text-[11px] font-bold text-[#7ee2a4] hover:bg-white/20"
                          onClick={() =>
                            setHouseNames((prev) => {
                              const next = { ...prev };
                              if (house.id in next) delete next[house.id];
                              else next[house.id] = "";
                              return next;
                            })
                          }
                        >
                          {house.id in houseNames ? "סגור" : "+ הוסף שחקנים לבית"}
                        </button>
                      )}
                    </div>
                    {!collapsed && (
                    <>
                    {canEdit && house.id in houseNames && (() => {
                      const names = (houseNames[house.id] ?? "")
                        .split(/\r?\n/)
                        .map((l) => l.replace(/^\s*\d+[.)-]?\s*/, "").trim())
                        .filter(Boolean);
                      return (
                        <div className="flex flex-col gap-2 px-4 py-3 border-b bg-muted/30">
                          <Textarea
                            value={houseNames[house.id] ?? ""}
                            onChange={(e) => setHouseNames((prev) => ({ ...prev, [house.id]: e.target.value }))}
                            placeholder={"שם אחד בכל שורה\nישראל ישראלי\nדני כהן"}
                            dir="auto"
                            rows={4}
                          />
                          <Button
                            size="sm"
                            className="self-start"
                            disabled={names.length === 0 || addToHouseMut.isPending}
                            onClick={() => addToHouseMut.mutate({ houseId: house.id, names })}
                          >
                            <Plus size={14} className="ml-1.5" />
                            הוסף {names.length || ""} לבית
                          </Button>
                        </div>
                      );
                    })()}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-[11px] text-muted-foreground border-b bg-muted/40">
                            <th className="text-center ps-3 pe-1 py-2 font-display font-bold w-10">#</th>
                            <th className="text-right px-2 py-2 font-display font-bold">שחקן</th>
                            <th className="text-center px-2 py-2 font-display font-bold">נ׳</th>
                            <th className="text-center px-2 py-2 font-display font-bold">פריימים</th>
                            <th className="text-center px-2 py-2 font-display font-bold">+/-</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => (
                            <tr key={row.participantId} className={cn("border-b border-border/40 last:border-b-0", i === 0 && row.wins > 0 && "bg-primary/8")}>
                              <td className="ps-3 pe-1 py-2 text-center">
                                <span className={cn("inline-flex w-7 h-7 items-center justify-center rounded-md bc-num text-sm", i === 0 && row.wins > 0 ? "bg-primary text-white" : "text-muted-foreground")}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                <span className="font-semibold">{participantName(row.participantId)}</span>
                                {canEdit && (
                                  <Select
                                    value={house.id}
                                    onValueChange={(v) => {
                                      if (!v || v === house.id) return;
                                      if (v === "none") removeFromHouseMut.mutate(row.participantId);
                                      else assignHouseMut.mutate({ participantId: row.participantId, houseId: v });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 w-24 text-[11px] font-display font-bold ms-2 inline-flex" aria-label="העבר לבית">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {locationHouses.map((h) => (
                                        <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                                      ))}
                                      <SelectItem value="none">הסר משיבוץ</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>
                              <td className="text-center px-2 py-2"><span className="bc-num text-base">{row.wins}</span></td>
                              <td className="text-center px-2 py-2 tabular-nums text-muted-foreground" dir="ltr">
                                {row.framesWon}-{row.framesLost}
                              </td>
                              <td
                                className={cn(
                                  "text-center px-2 py-2 tabular-nums font-semibold",
                                  row.framesWon - row.framesLost > 0 && "text-emerald-600 dark:text-emerald-400",
                                  row.framesWon - row.framesLost < 0 && "text-destructive",
                                )}
                                dir="ltr"
                              >
                                {row.framesWon - row.framesLost > 0 ? "+" : ""}
                                {row.framesWon - row.framesLost}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-2 p-3 border-t">
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
                          <LocationMatchRow
                            key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                            nameA={nameA}
                            nameB={nameB}
                            handicap={handicap}
                            match={m}
                            canEdit={canEdit}
                            onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                            saving={resultMut.isPending}
                            onClear={() => clearMut.mutate(m.id)}
                            clearing={clearMut.isPending}
                          />
                        );
                      })}
                    </div>
                    </>
                    )}
                  </div>
                );
              })}
              </div>
              )}
            </div>
          );
              })}
            </>
          );
        })()
      )}
    </div>
  );
}

function LocationMatchRow({
  nameA,
  nameB,
  handicap,
  match,
  canEdit,
  onSave,
  saving,
  onClear,
  clearing,
}: {
  nameA: string;
  nameB: string;
  handicap: string;
  match: HouseMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
  onClear: () => void;
  clearing: boolean;
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

  const box = (value: string, set: (v: string) => void) => (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => set(e.target.value)}
      className="h-7 w-12 text-center px-1 bc-num text-sm"
      disabled={saving}
    />
  );

  return (
    <MatchLine
      nameA={nameA}
      nameB={nameB}
      framesA={match.frames_a}
      framesB={match.frames_b}
      sub={handicap && !played ? handicap : undefined}
      scoreA={canEdit ? box(framesA, setFramesA) : undefined}
      scoreB={canEdit ? box(framesB, setFramesB) : undefined}
      aside={
        canEdit ? (
          <span className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 px-3 font-display text-xs font-bold"
              disabled={saving || framesA.trim() === "" || framesB.trim() === ""}
              onClick={save}
            >
              שמור
            </Button>
            {played && <ClearResultButton onClear={onClear} disabled={clearing} />}
          </span>
        ) : undefined
      }
    />
  );
}
