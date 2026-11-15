import { Trophy } from "lucide-react";
import type { Tournament } from "@/lib/sheets/tournaments";
import { ScheduleSlot } from "@/components/schedule-slot";

// Only ever rendered for a CRM-created tournament (event_date set) —
// an amber stripe and trophy mark it as a tournament, not training.
export function TournamentScheduleCard({
  tournament,
  basePath,
}: {
  tournament: Tournament;
  basePath: "coach" | "admin";
}) {
  return (
    <ScheduleSlot
      href={`/${basePath}/tournaments/${tournament.id}`}
      color="#f59e0b"
      kind={
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <Trophy size={12} />
          טורניר
        </span>
      }
      title={tournament.name}
      meta={tournament.type === "regular" && !tournament.manager_email ? <span className="text-amber-700 dark:text-amber-400">ללא מנהל</span> : undefined}
    />
  );
}
