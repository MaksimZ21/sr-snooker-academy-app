"use client";
import { useQuery } from "@tanstack/react-query";
import { SessionCard } from "./session-card";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate, todayIsoTel } from "@/lib/date";

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

  if (isLoading) return <div className="p-4">טוען...</div>;
  const sessions = (data?.sessions ?? []).slice().sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  const today = data?.today ?? todayIsoTel();
  const now = new Date();
  const nextIdx = sessions.findIndex((s) => {
    const [hh, mm] = s.start_time.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d >= now;
  });
  const next = nextIdx >= 0 ? sessions[nextIdx] : null;
  const previous = nextIdx > 0 ? sessions[nextIdx - 1] : sessions[sessions.length - 1] ?? null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">{formatHebrewDate(today)}</h1>
      <section>
        <h2 className="text-sm text-muted-foreground mb-2">המפגש הבא</h2>
        {next ? <SessionCard session={next} basePath={basePath} /> : (
          <div className="text-sm text-muted-foreground">אין מפגש קרוב</div>
        )}
      </section>
      <section>
        <h2 className="text-sm text-muted-foreground mb-2">המפגש הקודם</h2>
        {previous ? <SessionCard session={previous} basePath={basePath} /> : (
          <div className="text-sm text-muted-foreground">אין מפגש קודם</div>
        )}
      </section>
    </div>
  );
}
