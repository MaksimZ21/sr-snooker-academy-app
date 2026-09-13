"use client";
import Link from "next/link";
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

type LeagueParticipant = {
  id: string;
  league_id: string;
  student_id: string;
  district_id: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type LeagueDistrict = { id: string; league_id: string; label: string };

type League = {
  id: string;
  name: string;
  manager_email: string;
  num_cycles: number;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export function LeagueDetailView({
  leagueId,
  backHref,
  currentEmail,
  isAdmin,
}: {
  leagueId: string;
  backHref: string;
  currentEmail: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { league: League; participants: LeagueParticipant[]; districts: LeagueDistrict[] };
    },
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
  const canEdit = isAdmin || league.manager_email.trim().toLowerCase() === currentEmail.trim().toLowerCase();
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/l/${league.public_slug}` : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shield size={20} />}
        title={league.name}
        subtitle={`מנהל: ${league.manager_email}${league.completed ? " · הסתיימה" : ""}`}
        action={
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowRight size={14} />
            חזרה
          </Link>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">קישור ציבורי:</span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              /l/{league.public_slug}
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מספר סיבובים:</span>
            <span>{league.num_cycles}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מקדם פור:</span>
            <span>{league.handicap_points_per_rating_gap}</span>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">הוספת שחקן</p>
            <LeagueParticipantPicker leagueId={leagueId} />
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
            {`שחקנים (${participants.length})`}
          </p>
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
                    <p className="text-xs text-muted-foreground">
                      {p.student.phone || "—"} · דירוג {p.student.rating}
                    </p>
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

        <LeagueDistrictsView
          leagueId={leagueId}
          participants={participants}
          handicapPointsPerRatingGap={league.handicap_points_per_rating_gap}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
