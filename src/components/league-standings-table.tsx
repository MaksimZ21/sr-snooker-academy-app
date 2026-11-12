import { cn } from "@/lib/utils";
import type { LeagueStandingRow } from "@/lib/sheets/tournament-logic";

export type StandingLevel = { level: string | null; points: number };

// Short header on a phone, full header from md up.
function Head({ short, full, className }: { short: string; full: string; className?: string }) {
  return (
    <th className={cn("text-center px-1 md:px-2 py-1.5 font-medium", className)}>
      <span className="md:hidden">{short}</span>
      <span className="hidden md:inline">{full}</span>
    </th>
  );
}

const cell = "text-center px-1 md:px-2 py-1.5 tabular-nums";

// One table for both the admin league page and the public league page, so
// the two never drift apart. No hooks — renders on the server or client.
// `levels` (12 ft level + points gathered toward the next level change, by
// participant id) adds two columns before the place.
// Compact on a phone (short headers, tight padding) so the whole table fits
// without scrolling sideways.
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
      <table className="w-full text-xs md:text-sm whitespace-nowrap">
        <thead>
          <tr className="text-[10px] md:text-xs text-muted-foreground border-b border-border/40">
            {levels && (
              <>
                <Head short="דרגה" full="דרגה" className="ps-2 md:ps-4" />
                <Head short="נק׳" full="נק׳ דירוג" />
              </>
            )}
            <Head short="#" full="מקום" className={cn("text-right", !levels && "ps-2 md:ps-4")} />
            <th className="text-right px-1 md:px-2 py-1.5 font-medium">שם</th>
            <Head short="מש׳" full="משחקים" />
            <Head short="נ׳" full="נצחונות" />
            <Head short="ת׳" full="תיקו" />
            <Head short="ה׳" full="הפסדים" />
            <Head short="פריימים" full="מאזן פריימים" />
            <Head short="הפרש" full="הפרש" />
            <Head short="נק׳" full="נקודות" className="pe-2 md:pe-2" />
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
                    <td className={cn(cell, "ps-2 md:ps-4 font-semibold")}>{lv?.level ?? "—"}</td>
                    <td
                      className={cn(
                        cell,
                        "text-[11px] md:text-xs",
                        lv && lv.points > 0 && "text-emerald-600 dark:text-emerald-400",
                        lv && lv.points < 0 && "text-destructive",
                      )}
                      dir="ltr"
                    >
                      {lv ? (lv.points > 0 ? `+${lv.points}` : lv.points) : "—"}
                    </td>
                  </>
                )}
                <td
                  className={cn(
                    "px-1 md:px-2 py-1.5",
                    !levels && "ps-2 md:ps-4",
                    leading && "font-semibold text-primary",
                  )}
                >
                  {i + 1}
                </td>
                <td className={cn("px-1 md:px-2 py-1.5 max-w-[5.5rem] md:max-w-[9rem] truncate", leading && "font-semibold")}>
                  {renderName(row.participantId)}
                </td>
                <td className={cell}>{row.played}</td>
                <td className={cell}>{row.wins}</td>
                <td className={cell}>{row.draws}</td>
                <td className={cell}>{row.losses}</td>
                <td className={cell} dir="ltr">
                  {row.framesFor}-{row.framesAgainst}
                </td>
                <td className={cell} dir="ltr">
                  {diff > 0 ? "+" : ""}
                  {diff}
                </td>
                <td className={cn(cell, "pe-2 font-semibold")}>{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
