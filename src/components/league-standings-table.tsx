import { cn } from "@/lib/utils";
import type { LeagueStandingRow } from "@/lib/sheets/tournament-logic";
import { ExpandableStandingRow } from "@/components/expandable-standing-row";
import { dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

export type StandingLevel = { level: string | null; points: number };

export type RemainingMatch = { matchId: string; opponentId: string; date: string | null };

type MatchLike = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  scheduled_date: string | null;
};

// Each player's matches still to play (no result yet), by participant id.
export function remainingMatchesByParticipant(matches: MatchLike[]): Record<string, RemainingMatch[]> {
  const out: Record<string, RemainingMatch[]> = {};
  for (const m of matches) {
    if (m.frames_a !== null && m.frames_b !== null) continue;
    (out[m.participant_a_id] ??= []).push({ matchId: m.id, opponentId: m.participant_b_id, date: m.scheduled_date });
    (out[m.participant_b_id] ??= []).push({ matchId: m.id, opponentId: m.participant_a_id, date: m.scheduled_date });
  }
  for (const list of Object.values(out)) {
    // Scheduled ones first, by date; unscheduled last.
    list.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  }
  return out;
}

function RemainingDetail({
  list,
  nameOf,
}: {
  list: RemainingMatch[];
  nameOf: (participantId: string) => React.ReactNode;
}) {
  if (!list.length) return <p className="text-xs text-muted-foreground">שיחק כבר נגד כולם</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-muted-foreground">עוד לא שיחק נגד ({list.length}):</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map((r) => (
          <span key={r.matchId} className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-xs">
            {nameOf(r.opponentId)}
            <span className="text-muted-foreground">
              {" · "}
              {r.date ? `${dayLabelHe(r.date)} ${shortDate(r.date)}` : "לא שובץ"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

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
// `remaining` (from remainingMatchesByParticipant) makes each row tappable,
// opening the opponents that player hasn't played yet.
// Compact on a phone (short headers, tight padding) so the whole table fits
// without scrolling sideways.
export function LeagueStandingsTable({
  rows,
  renderName,
  highlightLeader = false,
  levels,
  remaining,
}: {
  rows: LeagueStandingRow[];
  renderName: (participantId: string) => React.ReactNode;
  highlightLeader?: boolean;
  levels?: Record<string, StandingLevel>;
  remaining?: Record<string, RemainingMatch[]>;
}) {
  const colSpan = levels ? 11 : 9;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs md:text-sm whitespace-nowrap">
        <thead>
          <tr className="text-[10px] md:text-xs text-muted-foreground border-b border-border/40">
            {levels && (
              <>
                <Head short="דרגה" full="דרגה" className="ps-2 md:ps-4" />
                {/* Two lines on a phone, so it isn't mistaken for the league points. */}
                <th className="text-center px-1 md:px-2 py-1.5 font-medium leading-tight">
                  <span className="md:hidden">
                    נק׳
                    <br />
                    דירוג
                  </span>
                  <span className="hidden md:inline">נק׳ דירוג</span>
                </th>
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
            const rowClass = cn("border-b border-border/20 last:border-b-0", leading && "bg-primary/5");
            const cells = (
              <>
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
              </>
            );
            return remaining ? (
              <ExpandableStandingRow
                key={row.participantId}
                className={rowClass}
                colSpan={colSpan}
                detail={<RemainingDetail list={remaining[row.participantId] ?? []} nameOf={renderName} />}
              >
                {cells}
              </ExpandableStandingRow>
            ) : (
              <tr key={row.participantId} className={rowClass}>
                {cells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
