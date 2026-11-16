"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { LeagueListRow } from "@/components/league-list-row";
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
      <h2 className="font-display text-base font-extrabold mb-2">{title}</h2>
      <div className="rounded-[18px] border bg-card overflow-hidden divide-y">
        {items.map((l) => (
          <LeagueListRow key={l.id} league={l} href={`/coach/leagues/${l.id}`} />
        ))}
      </div>
    </div>
  );
}
