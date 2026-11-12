import { cn } from "@/lib/utils";
import type { LeagueStandingRow } from "@/lib/sheets/tournament-logic";

export type StandingLevel = { level: string | null; points: number };

// One table for both the admin league page and the public league page, so
// the two never drift apart. No hooks — renders on the server or client.
// `levels` (12 ft level + level-change points, by participant id) adds two
// columns before the place; only the admin page passes it.
export function LeagueStandingsTable({
  rows,
  renderName,
  highlightLeader = false,
  levels,
}: {
  rows: LeagueStandingRow[];
  renderName: (participantId: string) => React.ReactNode;
  highlightLeader?: boolean;
  levels?: Record<string, StandingLevel>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border/40">
            {levels && (
              <>
                <th className="text-center ps-4 pe-1 py-1.5 font-medium">דרגה</th>
                <th className="text-center px-1 py-1.5 font-medium">פור</th>
              </>
            )}
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
            const lv = levels?.[row.participantId];
            return (
              <tr
                key={row.participantId}
                className={cn("border-b border-border/20 last:border-b-0", leading && "bg-primary/5")}
              >
                {levels && (
                  <>
                    <td className="text-center ps-4 pe-1 py-1.5 font-semibold">{lv?.level ?? "—"}</td>
                    <td
                      className={cn(
                        "text-center px-1 py-1.5 tabular-nums text-xs",
                        lv && lv.points > 0 && "text-emerald-600 dark:text-emerald-400",
                        lv && lv.points < 0 && "text-destructive",
                      )}
                      dir="ltr"
                    >
                      {lv ? (lv.points > 0 ? `+${lv.points}` : lv.points) : "—"}
                    </td>
                  </>
                )}
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
