"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TournamentListRow } from "@/components/tournament-list-row";
import { Trophy, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type Tournament = { id: string; name: string; manager_email: string | null; completed: boolean; public_slug: string };

export default function CoachTournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const r = await fetch("/api/tournaments");
      return (await r.json()) as { tournaments: Tournament[] };
    },
  });

  const tournaments = data?.tournaments ?? [];
  const active = tournaments.filter((t) => !t.completed);
  const completed = tournaments.filter((t) => t.completed);

  return (
    <div className="flex flex-col">
      <PageHeader icon={<Trophy size={20} />} title="טורנירים" subtitle={isLoading ? "טוען..." : `${tournaments.length} טורנירים`} />
      <div className="p-4 md:p-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין טורנירים</div>
        ) : (
          <>
            <TournamentList title="פעילים" items={active} />
            {completed.length > 0 && <TournamentList title="הסתיימו" items={completed} />}
          </>
        )}
      </div>
    </div>
  );
}

function TournamentList({ title, items }: { title: string; items: Tournament[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="font-display text-base font-extrabold mb-2">{title}</h2>
      <div className="rounded-[18px] border bg-card overflow-hidden divide-y">
        {items.map((t) => (
          <TournamentListRow key={t.id} tournament={t} href={`/coach/tournaments/${t.id}`} />
        ))}
      </div>
    </div>
  );
}
