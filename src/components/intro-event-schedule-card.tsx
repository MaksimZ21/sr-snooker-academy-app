import { UserPlus, Users, Banknote } from "lucide-react";
import type { IntroEventView } from "@/lib/sheets/intro-events";
import { ScheduleSlot } from "@/components/schedule-slot";

// Same slot as a session; the sky stripe and UserPlus mark it as an intro event.
export function IntroEventScheduleCard({
  event,
  basePath,
}: {
  event: IntroEventView;
  basePath: "coach" | "admin";
}) {
  return (
    <ScheduleSlot
      href={`/${basePath}/intro-events/${event.id}`}
      color="#0ea5e9"
      start={event.start_time}
      end={event.end_time}
      kind={
        <span className="flex items-center gap-1 text-sky-700 dark:text-sky-400">
          <UserPlus size={12} />
          היכרות
        </span>
      }
      title={event.name}
      meta={
        <>
          <span className="flex items-center gap-0.5 tabular-nums">
            <Users size={11} />
            {event.participant_count}
          </span>
          {event.price_nis != null && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Banknote size={11} />
              {event.price_nis}₪
            </span>
          )}
        </>
      }
    />
  );
}
