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

// Each player's last results (newest first), from a district's matches.
export type FormResult = "W" | "D" | "L";
export function formByParticipant(matches: MatchLike[], last = 5): Record<string, FormResult[]> {
  const played = matches
    .filter((m) => m.frames_a !== null && m.frames_b !== null)
    .sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""));
  const out: Record<string, FormResult[]> = {};
  for (const m of played) {
    const a = m.frames_a as number;
    const b = m.frames_b as number;
    const resA: FormResult = a === b ? "D" : a > b ? "W" : "L";
    const resB: FormResult = a === b ? "D" : a > b ? "L" : "W";
    for (const [id, res] of [
      [m.participant_a_id, resA],
      [m.participant_b_id, resB],
    ] as const) {
      const list = (out[id] ??= []);
      if (list.length < last) list.push(res);
    }
  }
  return out;
}

const FORM_STYLE: Record<FormResult, [string, string]> = {
  W: ["נ", "bg-primary text-white"],
  D: ["ת", "bg-muted-foreground/40 text-white"],
  L: ["ה", "bg-red-500 text-white"],
};

// Short header on a phone, full header from md up.
function Head({ short, full, className }: { short: string; full: string; className?: string }) {
  return (
    <th className={cn("text-center px-1 md:px-2 py-2.5 font-display font-bold", className)}>
      <span className="md:hidden">{short}</span>
      <span className="hidden md:inline">{full}</span>
    </th>
  );
}

const cell = "text-center px-1 md:px-2 py-2.5 tabular-nums";

// One table for both the admin league page and the public league page, so
// the two never drift apart. No hooks — renders on the server or client.
// Laid out like a sports-TV table: a dark header, the place in a box (the
// leader in green), each player's level beside the name, the league points
// as the loud column and the last results as a form guide.
// `levels` (12 ft level + points toward the next level change, by
// participant id) shows next to and under the name.
// `remaining` (from remainingMatchesByParticipant) makes each row tappable,
// opening the opponents that player hasn't played yet.
// `form` (from formByParticipant) adds the last results (from md up).
export function LeagueStandingsTable({
  rows,
  renderName,
  highlightLeader = true,
  levels,
  remaining,
  form,
}: {
  rows: LeagueStandingRow[];
  renderName: (participantId: string) => React.ReactNode;
  highlightLeader?: boolean;
  levels?: Record<string, StandingLevel>;
  remaining?: Record<string, RemainingMatch[]>;
  form?: Record<string, FormResult[]>;
}) {
  const colSpan = form ? 10 : 9;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] md:text-sm whitespace-nowrap">
        <thead>
          <tr className="bg-sidebar text-white/75 text-[11px] md:text-xs">
            <th className="text-center ps-2 md:ps-4 pe-1 py-2.5 font-display font-bold w-10">#</th>
            <th className="text-right px-1 md:px-2 py-2.5 font-display font-bold">שחקן</th>
            <Head short="מש׳" full="משחקים" />
            <Head short="נ׳" full="ניצחונות" />
            <Head short="ת׳" full="תיקו" />
            <Head short="ה׳" full="הפסדים" />
            <Head short="פריימים" full="פריימים" className="hidden sm:table-cell" />
            <Head short="+/-" full="הפרש" />
            {form && <Head short="צורה" full="צורה" className="hidden md:table-cell" />}
            <th className="text-center px-2 md:px-3 py-2.5 font-display font-extrabold bg-primary text-white">נק׳</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const diff = row.framesFor - row.framesAgainst;
            const leading = highlightLeader && i === 0 && row.played > 0;
            const lv = levels?.[row.participantId];
            const rowClass = cn(
              "border-b border-border/40 last:border-b-0",
              i % 2 === 1 && "bg-muted/25",
              leading && "bg-primary/8",
            );
            const results = form?.[row.participantId] ?? [];
            const cells = (
              <>
                <td className="ps-2 md:ps-4 pe-1 py-2 text-center">
                  <span
                    className={cn(
                      "inline-flex w-7 h-7 items-center justify-center rounded-md bc-num text-sm",
                      leading ? "bg-primary text-white" : i < 3 && row.played > 0 ? "bg-sidebar text-white" : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-1 md:px-2 py-2 max-w-[7.5rem] md:max-w-[14rem]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {lv?.level && (
                      <span className="shrink-0 rounded bg-sidebar text-white px-1 min-w-5 text-center font-display text-[11px] font-extrabold leading-5" dir="ltr">
                        {lv.level}
                      </span>
                    )}
                    <span className={cn("truncate", leading ? "font-extrabold" : "font-semibold")}>{renderName(row.participantId)}</span>
                  </div>
                  {lv && lv.points !== 0 && (
                    <span
                      className={cn(
                        "block text-[11px] leading-tight mt-0.5",
                        lv.points > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                      )}
                    >
                      נק׳ דירוג <bdi dir="ltr">{lv.points > 0 ? `+${lv.points}` : lv.points}</bdi>
                    </span>
                  )}
                </td>
                <td className={cell}>{row.played}</td>
                <td className={cell}>{row.wins}</td>
                <td className={cell}>{row.draws}</td>
                <td className={cell}>{row.losses}</td>
                <td className={cn(cell, "hidden sm:table-cell text-muted-foreground")} dir="ltr">
                  {row.framesFor}-{row.framesAgainst}
                </td>
                <td
                  className={cn(cell, "font-semibold", diff > 0 && "text-emerald-600 dark:text-emerald-400", diff < 0 && "text-destructive")}
                  dir="ltr"
                >
                  {diff > 0 ? "+" : ""}
                  {diff}
                </td>
                {form && (
                  <td className={cn(cell, "hidden md:table-cell")}>
                    <span className="inline-flex gap-1">
                      {results.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        results.map((r, k) => (
                          <span key={k} className={cn("w-5 h-5 rounded flex items-center justify-center font-display text-[11px] font-extrabold", FORM_STYLE[r][1])}>
                            {FORM_STYLE[r][0]}
                          </span>
                        ))
                      )}
                    </span>
                  </td>
                )}
                <td className="text-center px-2 md:px-3 py-2 bg-primary/8">
                  <span className="bc-num text-lg md:text-xl leading-none">{row.points}</span>
                </td>
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
