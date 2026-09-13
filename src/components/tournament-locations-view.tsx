"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

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
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-end gap-2">
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
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין אין מיקומים
        </div>
      ) : (
        locations.map((location) => {
          const locationHouses = houses.filter((h) => h.location_id === location.id);
          const unassigned = participants.filter((p) => p.location_id === location.id && !p.house_id);
          return (
            <div key={location.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <p className="text-sm font-semibold px-4 pt-3 pb-2">{location.label}</p>

              {canEdit && (
                <div className="flex items-end gap-2 px-4 pb-3">
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
                <div className="flex flex-col gap-2 px-4 pb-3 border-t border-border/40 pt-3">
                  <p className="text-xs font-medium text-muted-foreground">לא משוייכים לבית</p>
                  {unassigned.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                      </span>
                      {canEdit && locationHouses.length > 0 && (
                        <Select onValueChange={(v: string | null) => v && assignHouseMut.mutate({ participantId: p.id, houseId: v })}>
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue placeholder="בחר בית..." />
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

              {locationHouses.map((house) => {
                const standings = computeHouseStandings(house.memberIds, house.matches);
                return (
                  <div key={house.id} className="border-t border-border/40">
                    <p className="text-sm font-semibold px-4 pt-3 pb-2">{house.label}</p>
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
                              <td className="px-2 py-1.5">
                                {participantName(row.participantId)}
                                {canEdit && (
                                  <Select
                                    value={house.id}
                                    onValueChange={(v) => {
                                      if (!v || v === house.id) return;
                                      if (v === "none") removeFromHouseMut.mutate(row.participantId);
                                      else assignHouseMut.mutate({ participantId: row.participantId, houseId: v });
                                    }}
                                  >
                                    <SelectTrigger className="h-6 w-24 text-[10px] mr-2 inline-flex">
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
                          <LocationMatchRow
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
              })}
            </div>
          );
        })
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
