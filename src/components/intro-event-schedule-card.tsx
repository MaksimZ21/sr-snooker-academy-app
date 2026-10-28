import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, ChevronLeft, Users, Banknote } from "lucide-react";
import type { IntroEventView } from "@/lib/sheets/intro-events";

// Same layout as SessionCard (time on top, name + price + count below) so
// it reads like the rest of the Schedule; the sky stripe and UserPlus icon
// are what mark it as an intro event.
export function IntroEventScheduleCard({
  event,
  basePath,
}: {
  event: IntroEventView;
  basePath: "coach" | "admin";
}) {
  return (
    <Link href={`/${basePath}/intro-events/${event.id}`}>
      <Card className="group overflow-hidden transition-all duration-200 cursor-pointer border-border/60 hover:shadow-lg hover:-translate-y-0.5 shadow-sky-500/25">
        <CardContent className="p-0 flex">
          <div className="w-1.5 self-stretch shrink-0 bg-sky-500" />
          <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5 min-w-0">
            <div className="tabular-nums leading-tight">
              <span className="text-base font-bold">{event.start_time}</span>
              {event.end_time && (
                <span className="text-sm font-normal text-muted-foreground"> – {event.end_time}</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                <UserPlus size={12} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="truncate">{event.name}</span>
              </span>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground group-hover:text-primary transition-colors duration-200 shrink-0">
                {event.price_nis != null && (
                  <span className="flex items-center gap-0.5 font-semibold tabular-nums text-foreground/70">
                    <Banknote size={11} />
                    {event.price_nis}₪
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Users size={11} />
                  {event.participant_count}
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
