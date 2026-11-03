"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeBreakTable } from "@/lib/sheets/tournament-logic";
import { LeagueBreaksTable } from "@/components/league-breaks-table";

type Participant = { id: string; district_id: string | null; student: { first_name: string; last_name: string } };
type District = { id: string; label: string };
type LeagueBreak = { id: string; participant_id: string; value: number };

export function LeagueBreaksView({
  leagueId,
  participants,
  districts,
  canEdit,
}: {
  leagueId: string;
  participants: Participant[];
  districts: District[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [participantId, setParticipantId] = useState("");
  const [value, setValue] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["league-breaks", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/breaks`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { breaks: LeagueBreak[] };
    },
  });

  const rows = useMemo(() => computeBreakTable(data?.breaks ?? []), [data]);
  const nameOf = (id: string) => {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  };
  const districtOf = (id: string) => {
    const districtId = participants.find((x) => x.id === id)?.district_id;
    return districts.find((d) => d.id === districtId)?.label ?? "";
  };
  const sortedParticipants = [...participants].sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id), "he"));

  const addMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/breaks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, value: Number(value) }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בהוספת הברייק");
      }
    },
    onSuccess: () => {
      toast.success("הברייק נוסף");
      setValue("");
      qc.invalidateQueries({ queryKey: ["league-breaks", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהוספת הברייק"),
  });

  const deleteMut = useMutation({
    mutationFn: async (breakId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/breaks/${breakId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-breaks", leagueId] }),
    onError: () => toast.error("שגיאה במחיקת הברייק"),
  });

  const n = Number(value);
  const canAdd = participantId !== "" && Number.isInteger(n) && n >= 1 && n <= 155 && !addMut.isPending;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <p className="text-sm font-semibold px-4 pt-3 pb-2">טבלת ברייקים</p>

      {canEdit && (
        <div className="px-4 pb-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-44">
            <label className="text-xs text-muted-foreground mb-1 block">שחקן</label>
            <Select value={participantId} onValueChange={(v) => setParticipantId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="בחר שחקן..." />
              </SelectTrigger>
              <SelectContent>
                {sortedParticipants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{nameOf(p.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground mb-1 block">ברייק</label>
            <Input
              type="number"
              min={1}
              max={155}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdd) addMut.mutate();
              }}
            />
          </div>
          <Button onClick={() => addMut.mutate()} disabled={!canAdd}>
            <Plus size={14} className="ml-1.5" />
            הוסף
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="px-4 pb-4"><Skeleton className="h-16 w-full rounded-xl" /></div>
      ) : (
        <LeagueBreaksTable
          rows={rows}
          renderName={nameOf}
          districtOf={districtOf}
          onDelete={canEdit ? (id) => deleteMut.mutate(id) : undefined}
          deleting={deleteMut.isPending}
        />
      )}
    </div>
  );
}
