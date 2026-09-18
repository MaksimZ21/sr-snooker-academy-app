import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/lib/sheets/tournaments";

// Only ever rendered for a CRM-created tournament (event_date set) —
// visually distinct from SessionCard (amber stripe + trophy) so it's
// unmistakable at a glance that this slot is a tournament, not training.
export function TournamentScheduleCard({
  tournament,
  basePath,
}: {
  tournament: Tournament;
  basePath: "coach" | "admin";
}) {
  return (
    <Link href={`/${basePath}/tournaments/${tournament.id}`}>
      <Card className="group overflow-hidden transition-all duration-200 cursor-pointer border-border/60 hover:shadow-lg hover:-translate-y-0.5 hover:shadow-amber-500/25">
        <CardContent className="p-0 flex">
          <div className="w-1.5 self-stretch shrink-0 bg-amber-500" />
          <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <span className="flex items-center gap-1 text-sm font-bold text-amber-700 dark:text-amber-400">
                <Trophy size={14} />
                טורניר
              </span>
              {tournament.type === "regular" && !tournament.manager_email && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/60">
                  ללא מנהל
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{tournament.name}</span>
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
