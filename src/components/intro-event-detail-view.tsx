"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, UserPlus, User, Users, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntroEventParticipantPicker } from "@/components/intro-event-participant-picker";
import { formatHebrewDate } from "@/lib/date";
import {
  INTRO_EXPERIENCE_LEVELS,
  INTRO_EXPERIENCE_LEVEL_LABEL,
  INTRO_GOALS,
  INTRO_GOAL_LABEL,
  type IntroExperienceLevel,
  type IntroGoal,
} from "@/lib/sheets/intro-event-fields";
import type { IntroEventView } from "@/lib/sheets/intro-events";

type Coach = { email: string; name: string; active: boolean };

type IntroEventParticipant = {
  id: string;
  intro_event_id: string;
  student_id: string;
  experience_level: IntroExperienceLevel | null;
  goal: IntroGoal | null;
  student: { id: string; first_name: string; last_name: string; phone: string };
};

// Base UI's SelectValue renders the children function even when nothing is
// selected (the placeholder prop is then ignored), so the empty state has
// to be drawn here too.
function Placeholder({ text }: { text: string }) {
  return <span className="text-muted-foreground">{text}</span>;
}

export function IntroEventDetailView({
  introEventId,
  backHref,
  isAdmin,
}: {
  introEventId: string;
  backHref: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["intro-event", introEventId],
    queryFn: async () => {
      const r = await fetch(`/api/intro-events/${introEventId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { event: IntroEventView; participants: IntroEventParticipant[] };
    },
  });

  const { data: coachData } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    // Admin-only endpoint; a coach sees the email-prefix fallback below.
    enabled: isAdmin,
  });

  const coachMut = useMutation({
    mutationFn: async (coachEmail: string) => {
      const r = await fetch(`/api/intro-events/${introEventId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coach_email: coachEmail }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("מאמן אחראי עודכן");
      qc.invalidateQueries({ queryKey: ["intro-event", introEventId] });
      qc.invalidateQueries({ queryKey: ["intro-events"] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בעדכון"),
  });

  const fieldMut = useMutation({
    mutationFn: async ({
      participantId,
      field,
      value,
    }: {
      participantId: string;
      field: "experience_level" | "goal";
      value: string;
    }) => {
      const r = await fetch(`/api/intro-events/${introEventId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intro-event", introEventId] }),
    onError: () => toast.error("שגיאה בשמירה"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-4"><Skeleton className="h-32 w-full rounded-2xl" /></div>
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-center text-sm text-muted-foreground">האירוע לא נמצא</div>;
  }

  const { event, participants } = data;
  const activeCoaches = (coachData?.coaches ?? []).filter((c) => c.active);
  const coachName = event.coach_email
    ? ((coachData?.coaches ?? []).find((c) => c.email === event.coach_email)?.name ?? event.coach_email.split("@")[0])
    : null;

  return (
    <div className="flex flex-col">
      {/* Header — same look as the session detail page */}
      <div className="bg-brand-gradient relative overflow-hidden">
        <Link
          href={backHref}
          className="absolute top-3 start-3 z-20 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/15 transition-colors"
        >
          <ArrowRight size={14} />
          חזרה
        </Link>

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-10 pb-7">
          <p className="text-white/55 text-xs tracking-widest mb-2">{formatHebrewDate(event.event_date)}</p>
          <p className="flex items-center gap-1.5 text-white font-semibold text-base mb-4">
            <UserPlus size={16} className="shrink-0" />
            {event.name}
          </p>

          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-5xl md:text-6xl font-bold tabular-nums text-white leading-none tracking-tight scoreboard-num">
              {event.start_time || "--:--"}
            </span>
            <span className="text-white/30 text-3xl font-extralight select-none">—</span>
            <span className="text-5xl md:text-6xl font-bold tabular-nums text-white/85 leading-none tracking-tight scoreboard-num">
              {event.end_time || "--:--"}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center text-xs">
            <span className="flex items-center gap-1.5 text-white/65">
              <User size={11} className="shrink-0" />
              {coachName ?? "טרם הוגדר מאמן אחראי"}
            </span>
            <span className="flex items-center gap-1.5 text-white/45">
              <Users size={11} className="shrink-0" />
              {participants.length}
            </span>
            {event.price_nis != null && (
              <span className="flex items-center gap-1.5 text-white/65 tabular-nums">
                <Banknote size={11} className="shrink-0" />
                {event.price_nis}₪
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 flex flex-col gap-4">
        {isAdmin && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2">מאמן אחראי</p>
              <Select
                value={event.coach_email ?? undefined}
                onValueChange={(v) => v && coachMut.mutate(v)}
                disabled={coachMut.isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) =>
                      v ? (activeCoaches.find((c) => c.email === v)?.name ?? v) : <Placeholder text="בחר מאמן..." />
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeCoaches.map((c) => (
                    <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-2">הוסף משתתף</p>
              <IntroEventParticipantPicker introEventId={introEventId} />
            </div>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold mb-2">משתתפים ({participants.length})</p>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
              אין משתתפים עדיין
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {participants.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </span>
                    {p.student.phone && (
                      <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">{p.student.phone}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">רמת ניסיון במשחק</p>
                      {isAdmin ? (
                        <Select
                          value={p.experience_level ?? undefined}
                          onValueChange={(v) => v && fieldMut.mutate({ participantId: p.id, field: "experience_level", value: v })}
                          disabled={fieldMut.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v: string | null) =>
                                v ? INTRO_EXPERIENCE_LEVEL_LABEL[v as IntroExperienceLevel] ?? v : <Placeholder text="בחר..." />
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {INTRO_EXPERIENCE_LEVELS.map((lvl) => (
                              <SelectItem key={lvl} value={lvl}>{INTRO_EXPERIENCE_LEVEL_LABEL[lvl]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{p.experience_level ? INTRO_EXPERIENCE_LEVEL_LABEL[p.experience_level] : "—"}</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">מה רוצים להשיג באירוע</p>
                      {isAdmin ? (
                        <Select
                          value={p.goal ?? undefined}
                          onValueChange={(v) => v && fieldMut.mutate({ participantId: p.id, field: "goal", value: v })}
                          disabled={fieldMut.isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {(v: string | null) =>
                                v ? INTRO_GOAL_LABEL[v as IntroGoal] ?? v : <Placeholder text="בחר..." />
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {INTRO_GOALS.map((g) => (
                              <SelectItem key={g} value={g}>{INTRO_GOAL_LABEL[g]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{p.goal ? INTRO_GOAL_LABEL[p.goal] : "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
