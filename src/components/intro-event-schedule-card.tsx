import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, ChevronLeft } from "lucide-react";
import type { IntroEvent } from "@/lib/sheets/intro-events";

// Only ever rendered for an intro event (always CRM-created, always has
// an event_date) — visually distinct from both SessionCard (no stripe)
// and TournamentScheduleCard (amber/trophy): a sky stripe + UserPlus icon,
// so it's unmistakable at a glance that this slot is an intro event.
export function IntroEventScheduleCard({
  event,
  basePath,
}: {
  event: IntroEvent;
  basePath: "coach" | "admin";
}) {
  return (
    <Link href={`/${basePath}/intro-events/${event.id}`}>
      <Card className="group overflow-hidden transition-all duration-200 cursor-pointer border-border/60 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-sky-500/25">
        <CardContent className="p-0 flex">
          <div className="w-1.5 self-stretch shrink-0 bg-sky-500" />
          <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5 min-w-0">
            <span className="flex items-center gap-1 text-sm font-bold text-sky-700 dark:text-sky-400">
              <UserPlus size={14} />
              אירוע היכרות
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{event.name}</span>
              <ChevronLeft
                size={12}
                className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 text-muted-foreground shrink-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
