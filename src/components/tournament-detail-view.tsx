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
import { SKILL_LEVELS } from "@/lib/sheets/schemas";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      {children}
    </div>
  );
}

type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string | null;
  local_name: string | null;
  paid: boolean;
  payment_method: "cash" | "credit" | null;
  arrived: boolean;
  location_id: string | null;
  house_id: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number; skill_level: string | null };
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
  registration_closed: boolean;
  created_at: string;
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

type TournamentQueryData = { tournament: Tournament; participants: TournamentParticipant[] };

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
      return (await r.json()) as TournamentQueryData;
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
    mutationFn: async ({
      participantId,
      paid,
      paymentMethod,
    }: {
      participantId: string;
      paid: boolean;
      paymentMethod: "cash" | "credit" | null;
    }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid, payment_method: paymentMethod }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    // Optimistic: flip the cache immediately so the Select reflects the
    // pick right away instead of visibly reloading until the round trip
    // completes — only reconciled with the server on error (rollback) or
    // left as-is on success, since nothing server-side ever computes a
    // different paid/payment_method than what was sent.
    onMutate: async ({ participantId, paid, paymentMethod }) => {
      await qc.cancelQueries({ queryKey: ["tournament", tournamentId] });
      const previous = qc.getQueryData<TournamentQueryData>(["tournament", tournamentId]);
      qc.setQueryData<TournamentQueryData>(["tournament", tournamentId], (old) =>
        old
          ? {
              ...old,
              participants: old.participants.map((p) =>
                p.id === participantId ? { ...p, paid, payment_method: paymentMethod } : p,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tournament", tournamentId], ctx.previous);
      toast.error(e instanceof Error && e.message ? e.message : "שגיאה בעדכון התשלום");
    },
  });

  const skillLevelMut = useMutation({
    mutationFn: async ({ participantId, skillLevel }: { participantId: string; skillLevel: string | null }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}/skill-level`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillLevel }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onMutate: async ({ participantId, skillLevel }) => {
      await qc.cancelQueries({ queryKey: ["tournament", tournamentId] });
      const previous = qc.getQueryData<TournamentQueryData>(["tournament", tournamentId]);
      qc.setQueryData<TournamentQueryData>(["tournament", tournamentId], (old) =>
        old
          ? {
              ...old,
              participants: old.participants.map((p) =>
                p.id === participantId ? { ...p, student: { ...p.student, skill_level: skillLevel } } : p,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tournament", tournamentId], ctx.previous);
      toast.error(e instanceof Error && e.message ? e.message : "שגיאה בעדכון הסיווג");
    },
  });

  const arrivedMut = useMutation({
    mutationFn: async ({ participantId, arrived }: { participantId: string; arrived: boolean }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}/arrived`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ arrived }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onMutate: async ({ participantId, arrived }) => {
      await qc.cancelQueries({ queryKey: ["tournament", tournamentId] });
      const previous = qc.getQueryData<TournamentQueryData>(["tournament", tournamentId]);
      qc.setQueryData<TournamentQueryData>(["tournament", tournamentId], (old) =>
        old
          ? {
              ...old,
              participants: old.participants.map((p) => (p.id === participantId ? { ...p, arrived } : p)),
            }
          : old,
      );
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tournament", tournamentId], ctx.previous);
      toast.error(e instanceof Error && e.message ? e.message : "שגיאה בעדכון ההגעה");
    },
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

  const registrationClosedMut = useMutation({
    mutationFn: async (closed: boolean) => {
      const r = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration_closed: closed }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: (_data, closed) => {
      toast.success(closed ? "ההרשמה מה-CRM נסגרה לטורניר זה" : "ההרשמה מה-CRM נפתחה מחדש");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: () => toast.error("שגיאה בעדכון ההרשמה"),
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
  const arrivedCount = participants.filter((p) => p.arrived).length;
  const paidCount = participants.filter((p) => p.paid).length;
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
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill label="משתתפים" value={String(participants.length)} />
          {tournament.type === "regular" && (
            <>
              <StatPill label="הגיעו" value={`${arrivedCount}/${participants.length}`} />
              <StatPill label="שילמו" value={`${paidCount}/${participants.length}`} />
            </>
          )}
        </div>
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
              <span className="text-muted-foreground">הרשמה מה-CRM:</span>
              <Badge variant={tournament.registration_closed ? "secondary" : "default"}>
                {tournament.registration_closed ? "סגורה" : "פתוחה"}
              </Badge>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={registrationClosedMut.isPending}
                  onClick={() => registrationClosedMut.mutate(!tournament.registration_closed)}
                >
                  {tournament.registration_closed ? "פתח הרשמה" : "סגור הרשמה"}
                </Button>
              )}
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
              {participants.map((p) => {
                const paymentValue = p.paid ? (p.payment_method ?? "cash") : "unpaid";
                const isRealStudent = p.student.id !== "";
                return (
                  <div key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                      </p>
                      {tournament.type === "regular" && (
                        <p className="text-xs text-muted-foreground">{p.student.phone || "—"}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                              <SelectValue placeholder="ללא מיקום">
                                {(v: string) => (v === "none" ? "ללא מיקום" : locations.find((l) => l.id === v)?.label ?? v)}
                              </SelectValue>
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
                      {tournament.type === "regular" && isRealStudent && (
                        <FieldGroup label="סיווג">
                          {canEdit ? (
                            <Select
                              value={p.student.skill_level ?? "none"}
                              onValueChange={(v) => v && skillLevelMut.mutate({ participantId: p.id, skillLevel: v === "none" ? null : v })}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-8 w-20 text-xs",
                                  !p.student.skill_level &&
                                    "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/15 dark:bg-destructive/15",
                                )}
                              >
                                {/* SelectValue shows the raw value, not the matching
                                    SelectItem's children, unless Select is given an
                                    `items` map — map it back to a label ourselves. */}
                                <SelectValue placeholder="סיווג">
                                  {(v: string) => (v === "none" ? "ללא" : v)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">ללא</SelectItem>
                                {SKILL_LEVELS.map((l) => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className={cn(
                                "text-xs h-8 flex items-center",
                                p.student.skill_level ? "text-muted-foreground" : "text-destructive",
                              )}
                            >
                              {p.student.skill_level ?? "—"}
                            </span>
                          )}
                        </FieldGroup>
                      )}
                      {tournament.type === "regular" && (
                        <FieldGroup label="הגעה">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => arrivedMut.mutate({ participantId: p.id, arrived: !p.arrived })}
                            >
                              <Badge variant={p.arrived ? "default" : "outline"} className="cursor-pointer">
                                {p.arrived ? "הגיע" : "לא הגיע"}
                              </Badge>
                            </button>
                          ) : (
                            <Badge variant={p.arrived ? "default" : "outline"}>{p.arrived ? "הגיע" : "לא הגיע"}</Badge>
                          )}
                        </FieldGroup>
                      )}
                      {tournament.type === "regular" && (
                        <FieldGroup label="תשלום">
                          {canEdit ? (
                            <Select
                              value={paymentValue}
                              onValueChange={(v) => {
                                if (!v) return;
                                if (v === "unpaid") paidMut.mutate({ participantId: p.id, paid: false, paymentMethod: null });
                                else paidMut.mutate({ participantId: p.id, paid: true, paymentMethod: v as "cash" | "credit" });
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-8 w-28 text-xs",
                                  p.paid &&
                                    "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-300",
                                )}
                              >
                                <SelectValue>
                                  {(v: string) => (v === "unpaid" ? "לא שולם" : v === "credit" ? "אשראי" : "מזומן")}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unpaid">לא שולם</SelectItem>
                                <SelectItem value="cash">מזומן</SelectItem>
                                <SelectItem value="credit">אשראי</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={p.paid ? "default" : "secondary"}>
                              {p.paid ? (p.payment_method === "credit" ? "שולם · אשראי" : "שולם · מזומן") : "לא שולם"}
                            </Badge>
                          )}
                        </FieldGroup>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {participants.length > 0 && tournament.type === "regular" && (
          <TournamentHousesView
            tournamentId={tournamentId}
            participants={participants}
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
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-1.5 flex items-center gap-1.5">
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
