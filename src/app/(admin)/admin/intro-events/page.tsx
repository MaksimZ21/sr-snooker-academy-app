"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { UserPlus, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type IntroEvent = { id: string; name: string; event_date: string; coach_email: string | null };

export default function AdminIntroEventsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["intro-events"],
    queryFn: async () => {
      const r = await fetch("/api/intro-events");
      return (await r.json()) as { events: IntroEvent[] };
    },
  });

  const events = data?.events ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<UserPlus size={20} />}
        title="אירועי היכרות"
        subtitle={isLoading ? "טוען..." : `${events.length} אירועים`}
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
            אין אירועי היכרות עדיין — הם נוצרים אוטומטית מה-CRM
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/admin/intro-events/${e.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.event_date.slice(8, 10)}.{e.event_date.slice(5, 7)}.{e.event_date.slice(0, 4)}
                    {!e.coach_email && " · טרם הוגדר מאמן אחראי"}
                  </p>
                </div>
                <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
