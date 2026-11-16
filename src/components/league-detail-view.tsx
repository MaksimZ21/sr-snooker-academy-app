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
  // Players tab: show one district at a time ("all" / district id / "none").
  const [playersDistrict, setPlayersDistrict] = useState<string>("all");
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
          <div className="rounded-[18px] border bg-card overflow-hidden">
            {participants.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">אין שחקנים עדיין</div>
            ) : (
              <>
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] px-4 py-3 border-b">
                  {[
                    { key: "all", label: "הכל", n: participants.length },
                    ...districts.map((d) => ({ key: d.id, label: d.label, n: participants.filter((x) => x.district_id === d.id).length })),
                    { key: "none", label: "ללא מחוז", n: participants.filter((x) => !x.district_id).length },
                  ]
                    .filter((c) => c.key !== "none" || c.n > 0)
                    .map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setPlayersDistrict(c.key)}
                        aria-pressed={playersDistrict === c.key}
                        className={cn(
                          "shrink-0 rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-colors",
                          playersDistrict === c.key ? "bg-sidebar text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
                      </button>
                    ))}
                </div>
                <div className="divide-y divide-border/40">
                {participants
                  .filter((x) => playersDistrict === "all" || (playersDistrict === "none" ? !x.district_id : x.district_id === playersDistrict))
                  .map((p) => {
                  const fullName = [p.student.first_name, p.student.last_name].filter(Boolean).join(" ");
                  const digits = (p.student.phone ?? "").replace(/\D/g, "");
                  const wa = digits ? `https://wa.me/${digits.startsWith("972") ? digits : digits.startsWith("0") ? `972${digits.slice(1)}` : digits}` : null;
                  return (
                  <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <span className="w-9 h-9 rounded-xl bg-sidebar text-[#7ee2a4] flex items-center justify-center font-display text-xs font-extrabold shrink-0">
                      {fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate">{fullName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.student.phone && (
                          <a href={`tel:${p.student.phone}`} className="tabular-nums hover:text-primary" dir="ltr">{p.student.phone}</a>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1da851]">WhatsApp</a>
                        )}
                      </div>
                    </div>
                    {canEdit ? (
                      <Select
                        value={p.district_id ?? "none"}
                        onValueChange={(v) => assignMut.mutate({ participantId: p.id, districtId: v === "none" ? null : v })}
                      >
                        <SelectTrigger className={cn("h-9 w-36 text-xs font-display font-bold", !p.district_id && "border-amber-500/60 text-amber-700 dark:text-amber-400")}>
                          <SelectValue placeholder="ללא מחוז">
                            {(v: string) => (v === "none" ? "ללא מחוז" : districts.find((d) => d.id === v)?.label ?? v)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ללא מחוז</SelectItem>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-0.5 font-display text-xs font-bold text-muted-foreground">
                        {districts.find((d) => d.id === p.district_id)?.label ?? "ללא מחוז"}
                      </span>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(`להסיר את ${fullName} מהליגה?`)) removeMut.mutate(p.id);
                        }}
                        disabled={removeMut.isPending}
                        aria-label="הסרה מהליגה"
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                  );
                })}
                </div>
              </>
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
