"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Users } from "lucide-react";
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
  const previous =
    nextIdx > 0
      ? sessions[nextIdx - 1]
      : sessions[sessions.length - 1] ?? null;

  return (
    <div className="p-4 flex flex-col gap-6">
      <h1 className="text-xl font-bold">{formatHebrewDate(today)}</h1>

      <section className="flex flex-col gap-3">
        {isLoading ? (
          <HeroSkeleton />
        ) : next ? (
          <HeroNextCard session={next} basePath={basePath} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="text-center py-12 text-muted-foreground">
              אין מפגש קרוב
            </CardContent>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-muted-foreground">המפגש הקודם</h2>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : previous ? (
          <SessionCard session={previous} basePath={basePath} />
        ) : (
          <div className="text-sm text-muted-foreground">אין מפגש קודם</div>
        )}
      </section>
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
      <Card className="overflow-hidden border-2 border-primary/20 hover:shadow-lg transition">
        <div className="bg-brand-gradient-soft px-5 py-3">
          <div className="text-sm uppercase tracking-wide text-brand font-semibold">
            המפגש הבא
          </div>
        </div>
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <div
                className={cn(
                  "text-5xl md:text-6xl font-bold tabular-nums tracking-tight leading-none",
                  cancelled && "opacity-60 line-through",
                )}
              >
                {session.start_time}
              </div>
              <div className="text-muted-foreground mt-2">
                עד {session.end_time}
              </div>
            </div>
            <Badge className={cn("border", className)} variant="outline">
              {label}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Users size={16} className="text-muted-foreground" />
              <span>{session.student_ids.length} מתאמנים</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-brand font-medium">
              <span>פתח פרטים</span>
              <ChevronLeft size={16} />
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
      <div className="bg-brand-gradient-soft px-5 py-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
