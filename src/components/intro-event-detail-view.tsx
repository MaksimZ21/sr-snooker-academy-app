"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";
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
import { IntroEventParticipantPicker } from "@/components/intro-event-participant-picker";
import {
  INTRO_EXPERIENCE_LEVELS,
  INTRO_EXPERIENCE_LEVEL_LABEL,
  INTRO_GOALS,
  INTRO_GOAL_LABEL,
  type IntroExperienceLevel,
  type IntroGoal,
} from "@/lib/sheets/intro-event-fields";

type Coach = { email: string; name: string; active: boolean };

type IntroEventParticipant = {
  id: string;
  intro_event_id: string;
  student_id: string;
  experience_level: IntroExperienceLevel | null;
  goal: IntroGoal | null;
  student: { id: string; first_name: string; last_name: string; phone: string };
};

type IntroEvent = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  coach_email: string | null;
};

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
      return (await r.json()) as { event: IntroEvent; participants: IntroEventParticipant[] };
    },
  });

  const { data: coachData } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
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
      <div className="p-4 flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (!data) {
    return <div className="p-4 text-center text-sm text-muted-foreground">האירוע לא נמצא</div>;
  }

  const { event, participants } = data;
  const activeCoaches = (coachData?.coaches ?? []).filter((c) => c.active);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<UserPlus size={20} />}
        title={event.name}
        subtitle={`${event.event_date.slice(8, 10)}.${event.event_date.slice(5, 7)}.${event.event_date.slice(0, 4)}${event.start_time ? ` · ${event.start_time}` : ""}`}
        action={
          <Link href={backHref}>
            <Button variant="outline" size="sm">
              <ArrowRight size={14} className="ml-1.5" />
              חזרה
            </Button>
          </Link>
        }
      />

      <div className="px-4 md:px-6 flex flex-col gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">מאמן אחראי</p>
          {isAdmin ? (
            <Select
              value={event.coach_email ?? undefined}
              onValueChange={(v) => v && coachMut.mutate(v)}
              disabled={coachMut.isPending}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="בחר מאמן...">
                  {(v: string) => activeCoaches.find((c) => c.email === v)?.name ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeCoaches.map((c) => (
                  <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm font-medium">
              {activeCoaches.find((c) => c.email === event.coach_email)?.name ?? event.coach_email ?? "טרם הוגדר"}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground mb-2">הוסף משתתף</p>
            <IntroEventParticipantPicker introEventId={introEventId} />
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-sm font-semibold">משתתפים ({participants.length})</p>
          </div>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין משתתפים עדיין</div>
          ) : (
            <div className="divide-y divide-border/40">
              {participants.map((p) => (
                <div key={p.id} className="px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </span>
                    {p.student.phone && <span className="text-xs text-muted-foreground">{p.student.phone}</span>}
                  </div>
                  {isAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value={p.experience_level ?? undefined}
                        onValueChange={(v) => v && fieldMut.mutate({ participantId: p.id, field: "experience_level", value: v })}
                        disabled={fieldMut.isPending}
                      >
                        <SelectTrigger className="w-full max-w-[180px]">
                          <SelectValue placeholder="רמת ניסיון">
                            {(v: string) => INTRO_EXPERIENCE_LEVEL_LABEL[v as IntroExperienceLevel] ?? v}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {INTRO_EXPERIENCE_LEVELS.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>{INTRO_EXPERIENCE_LEVEL_LABEL[lvl]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={p.goal ?? undefined}
                        onValueChange={(v) => v && fieldMut.mutate({ participantId: p.id, field: "goal", value: v })}
                        disabled={fieldMut.isPending}
                      >
                        <SelectTrigger className="w-full max-w-[200px]">
                          <SelectValue placeholder="מה רוצים להשיג">
                            {(v: string) => INTRO_GOAL_LABEL[v as IntroGoal] ?? v}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {INTRO_GOALS.map((g) => (
                            <SelectItem key={g} value={g}>{INTRO_GOAL_LABEL[g]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{p.experience_level ? INTRO_EXPERIENCE_LEVEL_LABEL[p.experience_level] : "ללא רמת ניסיון"}</span>
                      <span>{p.goal ? INTRO_GOAL_LABEL[p.goal] : "ללא מטרה"}</span>
                    </div>
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
