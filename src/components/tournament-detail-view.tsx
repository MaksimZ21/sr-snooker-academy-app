"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Trophy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";
import { TournamentHousesView } from "@/components/tournament-houses-view";
import { TournamentLocationsView } from "@/components/tournament-locations-view";
import { TournamentKnockoutView } from "@/components/tournament-knockout-view";
import { EditTournamentDialog } from "@/components/edit-tournament-dialog";

type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string | null;
  local_name: string | null;
  paid: boolean;
  location_id: string | null;
  house_id: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type Tournament = {
  id: string;
  name: string;
  manager_email: string | null;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  type: "regular" | "multi_location";
  created_at: string;
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

export function TournamentDetailView({
  tournamentId,
  backHref,
  currentEmail,
  isAdmin,
}: {
  tournamentId: string;
  backHref: string;
  currentEmail: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { tournament: Tournament; participants: TournamentParticipant[] };
    },
  });

  const { data: locationsData } = useQuery({
    queryKey: ["tournament-locations", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { locations: TournamentLocation[] };
    },
    enabled: data?.tournament.type === "multi_location",
  });

  const paidMut = useMutation({
    mutationFn: async ({ participantId, paid }: { participantId: string; paid: boolean }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const assignLocationMut = useMutation({
    mutationFn: async ({ participantId, locationId }: { participantId: string; locationId: string | null }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}/location`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("שויך למיקום");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיוך למיקום"),
  });

  const removeMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("משתתף הוסר");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהסרה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const { tournament, participants } = data;
  const locations = locationsData?.locations ?? [];
  // A multi-location tournament has no manager coach — only an admin can
  // edit it, mirroring isTournamentManager on the server exactly.
  const canEdit =
    isAdmin ||
    (tournament.type === "regular" &&
      tournament.manager_email?.trim().toLowerCase() === currentEmail.trim().toLowerCase());
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${tournament.public_slug}` : "";
  const subtitle = [
    tournament.type === "regular" ? `מנהל: ${tournament.manager_email}` : null,
    tournament.completed ? "הסתיים" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Trophy size={20} />}
        title={tournament.name}
        subtitle={subtitle || undefined}
        action={
          <div className="flex items-center gap-3">
            {isAdmin && <EditTournamentDialog tournament={tournament} />}
            <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowRight size={14} />
              חזרה
            </Link>
          </div>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        {tournament.type === "regular" && !tournament.manager_email && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            ⚠️ טרם הוגדר מאמן אחראי לטורניר זה
          </div>
        )}
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">קישור ציבורי:</span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              /t/{tournament.public_slug}
              <ExternalLink size={12} />
            </a>
          </div>
          {tournament.rules_url && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">תקנון:</span>
              <a href={tournament.rules_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                קישור לתקנון
              </a>
            </div>
          )}
          {tournament.type === "regular" && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">מקדם פור:</span>
              <span>{tournament.handicap_points_per_rating_gap}</span>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">הוספת משתתף</p>
            <TournamentParticipantPicker tournamentId={tournamentId} multiLocation={tournament.type === "multi_location"} />
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
            {`משתתפים (${participants.length})`}
          </p>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין משתתפים עדיין</div>
          ) : (
            <div className="divide-y divide-border/40">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </p>
                    {tournament.type === "regular" && (
                      <p className="text-xs text-muted-foreground">
                        {p.student.phone || "—"} · דירוג {p.student.rating}
                      </p>
                    )}
                  </div>
                  {tournament.type === "multi_location" && (
                    !canEdit || p.house_id ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title={p.house_id ? "יש להסיר מהבית לפני שינוי מיקום" : undefined}
                      >
                        {locations.find((l) => l.id === p.location_id)?.label ?? "ללא מיקום"}
                      </span>
                    ) : (
                      <Select
                        value={p.location_id ?? "none"}
                        onValueChange={(v) => v && assignLocationMut.mutate({ participantId: p.id, locationId: v === "none" ? null : v })}
                        disabled={assignLocationMut.isPending}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="ללא מיקום" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ללא מיקום</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  )}
                  {tournament.type === "regular" && (canEdit ? (
                    <button
                      type="button"
                      onClick={() => paidMut.mutate({ participantId: p.id, paid: !p.paid })}
                      disabled={paidMut.isPending}
                    >
                      <Badge variant={p.paid ? "default" : "secondary"} className="cursor-pointer">
                        {p.paid ? "שולם" : "לא שולם"}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant={p.paid ? "default" : "secondary"}>{p.paid ? "שולם" : "לא שולם"}</Badge>
                  ))}
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

        {participants.length > 0 && tournament.type === "regular" && (
          <TournamentHousesView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}

        {participants.length > 0 && tournament.type === "multi_location" && (
          <TournamentLocationsView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}

        {participants.length > 0 && (
          <TournamentKnockoutView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
