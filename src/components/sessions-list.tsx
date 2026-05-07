"use client";
import { useQuery } from "@tanstack/react-query";
import { SessionCard } from "./session-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/lib/sheets/schemas";
import { CalendarX } from "lucide-react";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function monthLabel(yyyyMm: string) {
  const [year, month] = yyyyMm.split("-");
  return `${HEBREW_MONTHS[parseInt(month) - 1]} ${year}`;
}

function groupByMonth(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function SessionsList({
  basePath,
  coachEmail,
}: {
  basePath: "coach" | "admin";
  coachEmail?: string;
}) {
  const queryKey = ["sessions:mine", coachEmail ?? "me"];
  const url = coachEmail
    ? `/api/sessions/mine?coach=${encodeURIComponent(coachEmail)}`
    : "/api/sessions/mine";

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[] };
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </section>
        ))}
      </div>
    );
  }

  const grouped = groupByMonth(data?.sessions ?? []);

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <CalendarX size={42} className="opacity-25" />
        <span className="text-sm">אין מפגשים</span>
      </div>
    );
  }

  const total = data?.sessions.length ?? 0;

  return (
    <div className="p-4 flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">{total} מפגשים סה"כ</p>
      {grouped.map(([month, sessions]) => (
        <section key={month} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{monthLabel(month)}</h2>
            <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full">
              {sessions.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} basePath={basePath} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
