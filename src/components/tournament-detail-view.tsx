"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Trophy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";

type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type Tournament = {
  id: string;
  name: string;
  manager_email: string;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

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
  const canEdit = isAdmin || tournament.manager_email.trim().toLowerCase() === currentEmail.trim().toLowerCase();
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${tournament.public_slug}` : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Trophy size={20} />}
        title={tournament.name}
        subtitle={`מנהל: ${tournament.manager_email}${tournament.completed ? " · הסתיים" : ""}`}
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
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מקדם פור:</span>
            <span>{tournament.handicap_points_per_rating_gap}</span>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">הוספת משתתף</p>
            <TournamentParticipantPicker tournamentId={tournamentId} />
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
                    <p className="text-xs text-muted-foreground">
                      {p.student.phone || "—"} · דירוג {p.student.rating}
                    </p>
                  </div>
                  {canEdit ? (
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
      </div>
    </div>
  );
}
