"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarX, ChevronLeft, Users } from "lucide-react";
import { SessionCard } from "./session-card";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate, todayIsoTel } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";

export function Dashboard({
  basePath,
  pollMs,
}: {
  basePath: "coach" | "admin";
  pollMs: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["sessions:today"],
    queryFn: async () => {
      const r = await fetch("/api/sessions/today");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[]; today: string };
    },
    refetchInterval: pollMs,
  });

  const today = data?.today ?? todayIsoTel();
  const sessions = (data?.sessions ?? []).slice().sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  const now = new Date();
  const nextIdx = sessions.findIndex((s) => {
    const [hh, mm] = s.start_time.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d >= now;
  });
  const next = nextIdx >= 0 ? sessions[nextIdx] : null;
  let secondary: { session: Session; label: string } | null = null;
  if (nextIdx === -1 && sessions.length > 0) {
    secondary = { session: sessions[sessions.length - 1], label: "המפגש הקודם" };
  } else if (nextIdx > 0) {
    secondary = { session: sessions[nextIdx - 1], label: "המפגש הקודם" };
  } else if (nextIdx === 0 && sessions.length > 1) {
    secondary = { session: sessions[nextIdx + 1], label: "מאוחר יותר היום" };
  }

  return (
    <div className="p-4 flex flex-col gap-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-bold">{formatHebrewDate(today)}</h1>
        {!isLoading && sessions.length > 0 && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
            {sessions.length} מפגשים
          </span>
        )}
      </div>

      <section className="flex flex-col gap-3">
        {isLoading ? (
          <HeroSkeleton />
        ) : next ? (
          <HeroNextCard session={next} basePath={basePath} />
        ) : (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <CalendarX size={42} className="opacity-25" />
              <span className="text-sm">אין מפגש קרוב להיום</span>
            </CardContent>
          </Card>
        )}
      </section>

      {isLoading ? (
        <section className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </section>
      ) : secondary ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{secondary.label}</h2>
          <SessionCard session={secondary.session} basePath={basePath} />
        </section>
      ) : null}
    </div>
  );
}

function HeroNextCard({
  session,
  basePath,
}: {
  session: Session;
  basePath: "coach" | "admin";
}) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";

  return (
    <Link href={`/${basePath}/sessions/${session.id}`}>
      <Card className="overflow-hidden border-2 border-primary/25 hover:border-primary/50 hover:shadow-xl transition-all duration-300 group">
        {/* Gradient header strip */}
        <div className="bg-brand-gradient px-5 py-3 flex items-center justify-between">
          {/* Live pulsing indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-xs uppercase tracking-widest text-white/90 font-semibold">
              המפגש הבא
            </span>
          </div>
          <Badge
            className={cn("border text-xs font-medium", className)}
            variant="outline"
          >
            {label}
          </Badge>
        </div>

        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <div
                className={cn(
                  "text-5xl md:text-6xl font-bold tabular-nums tracking-tight leading-none text-foreground group-hover:text-primary transition-colors duration-300",
                  cancelled && "opacity-40 line-through",
                )}
              >
                {session.start_time}
              </div>
              <div className="text-muted-foreground mt-2 text-sm">
                עד {session.end_time}
              </div>
            </div>
            {cancelled && (
              <Badge variant="destructive" className="self-start">בוטל</Badge>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={15} />
              <span>{session.student_ids.length} מתאמנים</span>
            </div>
            <div className="flex items-center gap-0.5 text-sm text-primary font-semibold group-hover:gap-1.5 transition-all duration-200">
              <span>פתח פרטים</span>
              <ChevronLeft size={15} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HeroSkeleton() {
  return (
    <Card className="overflow-hidden border-2 border-primary/10">
      <div className="bg-brand-gradient px-5 py-3">
        <Skeleton className="h-4 w-32 bg-white/20" />
      </div>
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
