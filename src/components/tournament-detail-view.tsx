"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Trophy, ExternalLink, Trash2, Copy } from "lucide-react";
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
import { ParticipantNote } from "@/components/participant-note";
import { FoldSection } from "@/components/fold-section";
import { IspaBrand } from "@/components/ispa-brand";
import { type TableSize } from "@/lib/sheets/schemas";
import { useSkillLevels } from "@/components/use-skill-levels";
import { TableSizeBadge } from "@/components/table-size";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

function FieldGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-stretch gap-0.5", className)}>
      <span className="text-[11px] text-muted-foreground leading-none md:hidden">{label}</span>
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
  table_size: TableSize | null;
  created_at: string;
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

type TournamentQueryData = {
  tournament: Tournament;
  participants: TournamentParticipant[];
  participantNotes?: Record<string, string>;
};

const ALL_LOCATIONS = "__all__";
const NO_LOCATION_KEY = "__none__";

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
  // Multi-location: which location's participants the list shows.
  const [partsLocation, setPartsLocation] = useState<string>(ALL_LOCATIONS);
  // Tournament day: show only who still needs something.
  const [partsFilter, setPartsFilter] = useState<"all" | "not-arrived" | "unpaid" | "no-level">("all");
  const { levelsFor } = useSkillLevels();

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
      // Removing a participant cascades into their house matches (deleted)
      // and knockout slots (cleared) server-side — but those live in their
      // own separate queries, never invalidated here before, so they kept
      // showing the stale match data referencing the now-gone participant
      // id against the freshly-updated (smaller) participants list, which
      // showed up as "?" everywhere that stale reference still appeared.
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
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
  const participantNotes = data.participantNotes ?? {};
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
        brand={tournament.type === "multi_location" ? <IspaBrand /> : undefined}
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
        <div className="grid grid-cols-3 gap-2.5 max-w-xl">
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
            טרם הוגדר מאמן אחראי לטורניר זה
          </div>
        )}
        <div className="rounded-[18px] border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">קישור ציבורי:</span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              /t/{tournament.public_slug}
              <ExternalLink size={12} />
            </a>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success("הקישור הועתק");
                } catch {
                  toast.error("לא הצלחתי להעתיק, העתק ידנית");
                }
              }}
            >
              <Copy size={12} />
              העתק
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">שולחן:</span>
            {tournament.table_size ? <TableSizeBadge size={tournament.table_size} /> : <span>לא נבחר</span>}
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
          <div className="rounded-[18px] border bg-card p-4">
            <p className="font-display text-sm font-extrabold mb-2">הוספת משתתף</p>
            <TournamentParticipantPicker
              tournamentId={tournamentId}
              multiLocation={tournament.type === "multi_location"}
              locations={locations}
            />
          </div>
        )}

        <FoldSection title="רשימת משתתפים" storageKey="tournament:participants">
        <div className="rounded-[18px] border bg-card overflow-hidden">
          <div className="flex flex-col gap-2.5 px-4 py-3 border-b">
            <p className="font-display text-base font-extrabold">{`משתתפים (${participants.length})`}</p>
            {tournament.type === "regular" && participants.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
                {(
                  [
                    ["all", "הכל", participants.length],
                    ["not-arrived", "לא הגיעו", participants.filter((x) => !x.arrived).length],
                    ["unpaid", "לא שילמו", participants.filter((x) => !x.paid).length],
                    ["no-level", "ללא סיווג", participants.filter((x) => x.student.id !== "" && !x.student.skill_level).length],
                  ] as const
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPartsFilter(key)}
                    aria-pressed={partsFilter === key}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 font-display text-xs font-bold transition-colors",
                      partsFilter === key ? "bg-sidebar text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label} <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין משתתפים עדיין</div>
          ) : (
            (() => {
              const renderRow = (p: (typeof participants)[number]) => {
                const paymentValue = p.paid ? (p.payment_method ?? "cash") : "unpaid";
                const isRealStudent = p.student.id !== "";
                const fullName = [p.student.first_name, p.student.last_name].filter(Boolean).join(" ");
                const digits = (p.student.phone ?? "").replace(/\D/g, "");
                const wa = digits ? `https://wa.me/${digits.startsWith("972") ? digits : digits.startsWith("0") ? `972${digits.slice(1)}` : digits}` : null;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col gap-2.5 px-4 py-3 md:flex-row md:items-center md:gap-4",
                      tournament.type === "regular" && p.arrived && "bg-primary/5",
                    )}
                  >
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center font-display text-xs font-extrabold shrink-0",
                          p.arrived ? "bg-primary text-white" : "bg-sidebar text-[#7ee2a4]",
                        )}
                      >
                        {fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold truncate">{fullName}</p>
                        {tournament.type === "regular" && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {p.student.phone ? (
                              <a href={`tel:${p.student.phone}`} className="tabular-nums hover:text-primary" dir="ltr">{p.student.phone}</a>
                            ) : (
                              <span>—</span>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noopener noreferrer" className="font-bold text-[#1da851]">WhatsApp</a>
                            )}
                          </div>
                        )}
                        <ParticipantNote
                          tournamentId={tournamentId}
                          participantId={p.id}
                          note={participantNotes[p.id] ?? ""}
                          canEdit={canEdit}
                        />
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive md:hidden"
                          onClick={() => {
                            if (window.confirm(`להסיר את ${fullName} מהטורניר?`)) removeMut.mutate(p.id);
                          }}
                          disabled={removeMut.isPending}
                          aria-label="הסרה מהטורניר"
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] md:flex md:flex-wrap items-center gap-2">
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
                            <SelectTrigger className="h-9 w-36 text-xs">
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
                                  "h-9 w-[4.5rem] text-xs font-display font-bold",
                                  !p.student.skill_level &&
                                    "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/15 dark:bg-destructive/15",
                                )}
                              >
                                {/* SelectValue shows the raw value, not the matching
                                    SelectItem's children, unless Select is given an
                                    `items` map — map it back to a label ourselves. */}
                                <SelectValue placeholder="סיווג">
                                  {(v: string) => (v === "none" ? "סיווג?" : v)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">ללא</SelectItem>
                                {levelsFor(tournament.table_size).map((l) => (
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
                        canEdit ? (
                          <button
                            type="button"
                            onClick={() => arrivedMut.mutate({ participantId: p.id, arrived: !p.arrived })}
                            aria-pressed={p.arrived}
                            className={cn(
                              "h-9 rounded-xl border px-3 font-display text-[13px] font-bold transition-colors md:w-28",
                              p.arrived ? "bg-primary border-primary text-white" : "bg-card text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {p.arrived ? "✓ הגיע" : "סמן הגעה"}
                          </button>
                        ) : (
                          <Badge variant={p.arrived ? "default" : "outline"}>{p.arrived ? "הגיע" : "לא הגיע"}</Badge>
                        )
                      )}
                      {tournament.type === "regular" && (
                        <FieldGroup label="תשלום" className="col-span-2 md:col-span-1">
                          {canEdit ? (
                            <div className="flex rounded-xl border bg-muted/40 p-0.5">
                              {(
                                [
                                  ["unpaid", "לא שולם"],
                                  ["cash", "מזומן"],
                                  ["credit", "אשראי"],
                                ] as const
                              ).map(([v, label]) => (
                                <button
                                  key={v}
                                  type="button"
                                  aria-pressed={paymentValue === v}
                                  onClick={() => {
                                    if (paymentValue === v) return;
                                    if (v === "unpaid") paidMut.mutate({ participantId: p.id, paid: false, paymentMethod: null });
                                    else paidMut.mutate({ participantId: p.id, paid: true, paymentMethod: v });
                                  }}
                                  className={cn(
                                    "flex-1 h-8 px-2.5 rounded-[10px] font-display text-xs font-bold whitespace-nowrap transition-colors",
                                    paymentValue === v
                                      ? v === "unpaid"
                                        ? "bg-amber-500 text-white"
                                        : "bg-primary text-white"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
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
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hidden md:inline-flex"
                          onClick={() => {
                            if (window.confirm(`להסיר את ${fullName} מהטורניר?`)) removeMut.mutate(p.id);
                          }}
                          disabled={removeMut.isPending}
                          aria-label="הסרה מהטורניר"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              };
              if (tournament.type !== "multi_location" || locations.length === 0) {
                const rows = participants.filter((x) =>
                  partsFilter === "not-arrived"
                    ? !x.arrived
                    : partsFilter === "unpaid"
                      ? !x.paid
                      : partsFilter === "no-level"
                        ? x.student.id !== "" && !x.student.skill_level
                        : true,
                );
                return rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">אין משתתפים שמתאימים לסינון</p>
                ) : (
                  <div className="divide-y divide-border/40">{rows.map(renderRow)}</div>
                );
              }
              const keyOf = (p: (typeof participants)[number]) => p.location_id ?? NO_LOCATION_KEY;
              const groups = [
                ...locations.map((l) => ({ key: l.id, label: l.label })),
                { key: NO_LOCATION_KEY, label: "ללא מיקום" },
              ]
                .map((g) => ({ ...g, rows: participants.filter((p) => keyOf(p) === g.key) }))
                .filter((g) => g.rows.length > 0 || g.key !== NO_LOCATION_KEY);
              const shown = groups.filter((g) => partsLocation === ALL_LOCATIONS || g.key === partsLocation);
              return (
                <>
                  <div className="flex flex-wrap gap-2 px-4 pb-3">
                    {[{ key: ALL_LOCATIONS, label: "הכל", count: participants.length }, ...groups.map((g) => ({ key: g.key, label: g.label, count: g.rows.length }))].map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setPartsLocation(b.key)}
                        aria-pressed={partsLocation === b.key}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                          partsLocation === b.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {b.label} ({b.count})
                      </button>
                    ))}
                  </div>
                  {shown.map((g) => (
                    <div key={g.key} className="border-t border-border/40">
                      <p className="px-4 pt-3 pb-1 text-sm font-semibold">
                        {g.label} <span className="text-xs font-normal text-muted-foreground">({g.rows.length})</span>
                      </p>
                      {g.rows.length === 0 ? (
                        <p className="px-4 pb-3 text-xs text-muted-foreground">אין משתתפים במיקום הזה</p>
                      ) : (
                        <div className="divide-y divide-border/40">{g.rows.map(renderRow)}</div>
                      )}
                    </div>
                  ))}
                </>
              );
            })()
          )}
        </div>
        </FoldSection>

        {participants.length > 0 && tournament.type === "regular" && (
          <FoldSection title="בתים" storageKey="tournament:houses">
            <TournamentHousesView
              tournamentId={tournamentId}
              participants={participants}
              canEdit={canEdit}
            />
          </FoldSection>
        )}

        {tournament.type === "multi_location" && (
          <FoldSection title="מיקומים ובתים" storageKey="tournament:locations">
            <TournamentLocationsView
              tournamentId={tournamentId}
              participants={participants}
              handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
              canEdit={canEdit}
            />
          </FoldSection>
        )}

        {participants.length > 0 && (
          <FoldSection title="נוקאאוט" storageKey="tournament:knockout">
            <TournamentKnockoutView
              tournamentId={tournamentId}
              participants={participants}
              canEdit={canEdit}
            />
          </FoldSection>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border bg-card px-3.5 py-3 flex flex-col gap-1">
      <span className="bc-num text-3xl leading-none" dir="ltr">{value}</span>
      <span className="font-display text-xs font-bold text-muted-foreground">{label}</span>
    </div>
  );
}
