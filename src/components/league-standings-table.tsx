import { cn } from "@/lib/utils";
import type { LeagueStandingRow } from "@/lib/sheets/tournament-logic";

// One table for both the admin league page and the public league page, so
// the two never drift apart. No hooks — renders on the server or client.
export function LeagueStandingsTable({
  rows,
  renderName,
  highlightLeader = false,
}: {
  rows: LeagueStandingRow[];
  renderName: (participantId: string) => React.ReactNode;
  highlightLeader?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border/40">
            <th className="text-right px-4 py-1.5 font-medium">מקום</th>
            <th className="text-right px-2 py-1.5 font-medium">שם</th>
            <th className="text-center px-2 py-1.5 font-medium">משחקים</th>
            <th className="text-center px-2 py-1.5 font-medium">נצחונות</th>
            <th className="text-center px-2 py-1.5 font-medium">תיקו</th>
            <th className="text-center px-2 py-1.5 font-medium">הפסדים</th>
            <th className="text-center px-2 py-1.5 font-medium">מאזן פריימים</th>
            <th className="text-center px-2 py-1.5 font-medium">הפרש</th>
            <th className="text-center px-2 py-1.5 font-medium">נקודות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const diff = row.framesFor - row.framesAgainst;
            const leading = highlightLeader && i === 0;
            return (
              <tr
                key={row.participantId}
                className={cn("border-b border-border/20 last:border-b-0", leading && "bg-primary/5")}
              >
                <td className={cn("px-4 py-1.5", leading && "font-semibold text-primary")}>{i + 1}</td>
                <td className={cn("px-2 py-1.5 max-w-[9rem] truncate", leading && "font-semibold")}>
                  {renderName(row.participantId)}
                </td>
                <td className="text-center px-2 py-1.5 tabular-nums">{row.played}</td>
                <td className="text-center px-2 py-1.5 tabular-nums">{row.wins}</td>
                <td className="text-center px-2 py-1.5 tabular-nums">{row.draws}</td>
                <td className="text-center px-2 py-1.5 tabular-nums">{row.losses}</td>
                <td className="text-center px-2 py-1.5 tabular-nums" dir="ltr">
                  {row.framesFor}-{row.framesAgainst}
                </td>
                <td className="text-center px-2 py-1.5 tabular-nums" dir="ltr">
                  {diff > 0 ? "+" : ""}
                  {diff}
                </td>
                <td className="text-center px-2 py-1.5 tabular-nums font-semibold">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
