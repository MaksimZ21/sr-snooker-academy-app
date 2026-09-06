"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronLeft, Banknote } from "lucide-react";
import type { Group, Session } from "@/lib/sheets/schemas";
import { formatHebrewDate } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";

// Stripe colors mapped to snooker ball colors
const STRIPE: Record<string, string> = {
  private: "bg-red-600",
  group: "bg-blue-500",
  beginners: "bg-yellow-400",
  advanced: "bg-pink-500",
  technique: "bg-stone-500",
  "match-play": "bg-emerald-600",
};

const STRIPE_GLOW: Record<string, string> = {
  private: "shadow-red-600/25",
  group: "shadow-blue-500/25",
  beginners: "shadow-yellow-400/25",
  advanced: "shadow-pink-500/25",
  technique: "shadow-stone-500/25",
  "match-play": "shadow-emerald-600/25",
};

export function SessionCard({
  session,
  basePath,
}: {
  session: Session;
  basePath: "coach" | "admin";
}) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const stripe = STRIPE[session.training_type] ?? "bg-muted-foreground/40";
  const glow = STRIPE_GLOW[session.training_type] ?? "";
  const cancelled = session.status === "cancelled";

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: Group[] };
    },
    staleTime: 5 * 60_000,
  });
  const groupName = session.group_id
    ? groupsQ.data?.groups.find((g) => g.id === session.group_id)?.name
    : undefined;
  const subLabel = session.name || groupName || formatHebrewDate(session.date);

  return (
    <Link href={`/${basePath}/sessions/${session.id}`}>
      <Card className={cn(
        "group overflow-hidden transition-all duration-200 cursor-pointer border-border/60",
        "hover:shadow-lg hover:-translate-y-0.5",
        !cancelled && glow,
      )}>
        <CardContent className="p-0 flex">
          {/* Color stripe */}
          <div className={cn(
            "w-1.5 self-stretch shrink-0 transition-all duration-200",
            stripe,
            cancelled && "opacity-30",
          )} />

          <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5 min-w-0">
            {/* Group name, so it's clear at a glance which group this is */}
            {groupName && (
              <p className="text-[11px] font-medium text-muted-foreground truncate -mb-1">
                {groupName}
              </p>
            )}

            {/* Top row: time + badges */}
            <div className="flex justify-between items-start gap-2">
              <div className={cn(
                "tabular-nums leading-tight",
                cancelled && "opacity-40 line-through",
              )}>
                <span className="text-base font-bold">{session.start_time}</span>
                <span className="text-sm font-normal text-muted-foreground"> – {session.end_time}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge className={cn("border text-xs", className)} variant="outline">
                  {label}
                </Badge>
                {cancelled && (
                  <Badge variant="destructive" className="text-xs">בוטל</Badge>
                )}
              </div>
            </div>

            {/* Bottom row: name/date + price + students */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <span className="truncate">{subLabel}</span>
                {session.source ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 border-border/60 shrink-0"
                  >
                    {session.source}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0">
                {session.price_nis != null && (
                  <span className="flex items-center gap-0.5 font-semibold tabular-nums text-foreground/70">
                    <Banknote size={11} />
                    {session.price_nis}₪
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Users size={11} />
                  {session.student_ids.length}
                </span>
                <ChevronLeft
                  size={12}
                  className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
