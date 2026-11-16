"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeagueParticipantPicker } from "@/components/league-participant-picker";
import { LeagueDistrictsView } from "@/components/league-districts-view";
import { LeagueScheduleView } from "@/components/league-schedule-view";
import { LeagueBreaksView } from "@/components/league-breaks-view";
import { LeagueLevelsView } from "@/components/league-levels-view";
import { cn } from "@/lib/utils";
import { TableSizeBadge, TableSizeSelect } from "@/components/table-size";
import type { TableSize } from "@/lib/sheets/schemas";

type LeagueParticipant = {
  id: string;
  league_id: string;
  student_id: string;
  district_id: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type LeagueDistrict = { id: string; league_id: string; label: string; num_cycles: number };

type League = {
  id: string;
  name: string;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  table_size: TableSize | null;
  created_at: string;
};

const LEAGUE_TABS = [
  ["districts", "מחוזות ותוצאות"],
  ["schedule", "לוז"],
  ["players", "שחקנים"],
  ["levels", "דירוג"],
  ["breaks", "ברייקים"],
] as const;
type LeagueTab = (typeof LEAGUE_TABS)[number][0];

export function LeagueDetailView({
  leagueId,
  backHref,
  isAdmin,
}: {
  leagueId: string;
  backHref: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  // Which part of the league is open; remembered per league on this device.
  const [tab, setTab] = useState<LeagueTab>("districts");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`league-tab:${leagueId}`);
      if (saved && LEAGUE_TABS.some(([k]) => k === saved)) setTab(saved as LeagueTab);
    } catch {}
  }, [leagueId]);
  function pickTab(key: LeagueTab) {
    setTab(key);
    try {
      localStorage.setItem(`league-tab:${leagueId}`, key);
    } catch {}
  }

  const { data, isLoading } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { league: League; participants: LeagueParticipant[]; districts: LeagueDistrict[] };
    },
  });

  const tableSizeMut = useMutation({
    mutationFn: async (tableSize: TableSize | null) => {
      const r = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table_size: tableSize }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("השולחן עודכן");
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const assignMut = useMutation({
    mutationFn: async ({ participantId, districtId }: { participantId: string; districtId: string | null }) => {
      const r = await fetch(`/api/leagues/${leagueId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ districtId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("שויך למחוז");
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיוך למחוז"),
  });

  const removeMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("שחקן הוסר");
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בהסרה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const { league, participants, districts } = data;
  const canEdit = isAdmin;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/l/${league.public_slug}` : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shield size={20} />}
        title={league.name}
        subtitle={league.completed ? "הסתיימה" : undefined}
        action={
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowRight size={14} />
            חזרה
          </Link>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        <div className="rounded-[18px] border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">קישור ציבורי:</span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              /l/{league.public_slug}
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">שולחן:</span>
            {canEdit ? (
              <div className="w-36">
                <TableSizeSelect
                  value={league.table_size}
                  onChange={(v) => tableSizeMut.mutate(v)}
                  disabled={tableSizeMut.isPending}
                />
              </div>
            ) : league.table_size ? (
              <TableSizeBadge size={league.table_size} />
            ) : (
              <span>לא נבחר</span>
            )}
          </div>
        </div>

        {/* One part of the league at a time, like the public page, instead of one long scroll. */}
        <div className="sticky top-0 z-20 -mx-4 md:mx-0 px-4 md:px-0 py-2 bg-background/95 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-sidebar p-1 [scrollbar-width:none]">
            {LEAGUE_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => pickTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 font-display text-sm font-bold transition-colors",
                  tab === key ? "bg-primary text-white" : "text-white/60 hover:text-white",
                )}
              >
                {key === "players" ? `${label} (${participants.length})` : label}
              </button>
            ))}
          </div>
        </div>

        {canEdit && tab === "players" && (
          <div className="rounded-[18px] border bg-card p-4">
            <p className="font-display text-sm font-extrabold mb-2">הוספת שחקן</p>
            <LeagueParticipantPicker leagueId={leagueId} />
          </div>
        )}

        {tab === "players" && (
          <>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {participants.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">אין שחקנים עדיין</div>
            ) : (
              <div className="divide-y divide-border/40">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                      </p>
                      {p.student.phone && (
                        <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">{p.student.phone}</p>
                      )}
                    </div>
                    {canEdit ? (
                      <Select
                        value={p.district_id ?? "none"}
                        onValueChange={(v) => assignMut.mutate({ participantId: p.id, districtId: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="ללא מחוז" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ללא מחוז</SelectItem>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {districts.find((d) => d.id === p.district_id)?.label ?? "ללא מחוז"}
                      </span>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMut.mutate(p.id)}
                        disabled={removeMut.isPending}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {tab === "levels" && (
          <>
          <LeagueLevelsView leagueId={leagueId} canEdit={canEdit} />
          </>
        )}

        {tab === "schedule" && (
          <>
          <LeagueScheduleView
            leagueId={leagueId}
            leagueName={league.name}
            participants={participants}
            canEdit={canEdit}
          />
          </>
        )}

        {tab === "districts" && (
          <>
          <LeagueDistrictsView
            leagueId={leagueId}
            participants={participants}
            canEdit={canEdit}
          />
          </>
        )}

        {tab === "breaks" && (
          <>
          <LeagueBreaksView
            leagueId={leagueId}
            participants={participants}
            districts={districts}
            canEdit={canEdit}
          />
          </>
        )}
      </div>
    </div>
  );
}
