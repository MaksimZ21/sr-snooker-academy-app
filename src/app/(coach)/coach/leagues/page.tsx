"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type League = { id: string; name: string; completed: boolean };

export default function CoachLeaguesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const r = await fetch("/api/leagues");
      return (await r.json()) as { leagues: League[] };
    },
  });

  const leagues = data?.leagues ?? [];
  const active = leagues.filter((l) => !l.completed);
  const completed = leagues.filter((l) => l.completed);

  return (
    <div className="flex flex-col">
      <PageHeader icon={<Shield size={20} />} title="ליגות" subtitle={isLoading ? "טוען..." : `${leagues.length} ליגות`} />
      <div className="p-4 md:p-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין ליגות</div>
        ) : (
          <>
            <LeagueList title="פעילות" items={active} />
            {completed.length > 0 && <LeagueList title="הסתיימו" items={completed} />}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueList({ title, items }: { title: string; items: League[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((l) => (
          <Link
            key={l.id}
            href={`/coach/leagues/${l.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{l.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
