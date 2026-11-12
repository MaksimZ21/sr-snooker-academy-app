"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { computeBreakTable } from "@/lib/sheets/tournament-logic";
import { LeagueBreaksTable } from "@/components/league-breaks-table";
import { BreaksSearchInput } from "@/components/breaks-search-input";

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
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["league-breaks", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/breaks`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { breaks: LeagueBreak[] };
    },
  });

  const nameOf = (id: string) => {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  };
  const districtOf = (id: string) => {
    const districtId = participants.find((x) => x.id === id)?.district_id;
    return districts.find((d) => d.id === districtId)?.label ?? "";
  };

  // Players without breaks keep this alphabetical order at the bottom.
  const rows = useMemo(() => {
    const ids = participants
      .map((p) => ({ id: p.id, name: [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((p) => p.id);
    return computeBreakTable(ids, data?.breaks ?? []);
  }, [participants, data]);

  const addMut = useMutation({
    mutationFn: async ({ participantId, value }: { participantId: string; value: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/breaks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId, value }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בהוספת הברייק");
      }
    },
    onSuccess: () => {
      toast.success("הברייק נוסף");
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

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="pt-3" />
      <BreaksSearchInput value={query} onChange={setQuery} />
      {isLoading ? (
        <div className="px-4 pb-4"><Skeleton className="h-16 w-full rounded-xl" /></div>
      ) : (
        <LeagueBreaksTable
          rows={rows}
          renderName={nameOf}
          nameText={nameOf}
          query={query}
          districtOf={districtOf}
          onDelete={canEdit ? (id) => deleteMut.mutate(id) : undefined}
          deleting={deleteMut.isPending}
          renderAdd={
            canEdit
              ? (participantId) => (
                  <AddBreakInput
                    // A successful add remounts the input empty.
                    key={`${participantId}:${rows.find((r) => r.participantId === participantId)?.breaks.length ?? 0}`}
                    onAdd={(value) => addMut.mutate({ participantId, value })}
                    disabled={addMut.isPending}
                  />
                )
              : undefined
          }
        />
      )}
    </div>
  );
}

function AddBreakInput({ onAdd, disabled }: { onAdd: (value: number) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 155;

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={1}
        max={155}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid && !disabled) onAdd(n);
        }}
        placeholder="ברייק"
        className="h-8 w-20 text-center px-1"
        disabled={disabled}
      />
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={() => onAdd(n)}
        disabled={!valid || disabled}
        aria-label="הוסף ברייק"
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
