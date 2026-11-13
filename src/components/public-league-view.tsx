import Image from "next/image";
import { computeLeagueStandings, computeBreakTable } from "@/lib/sheets/tournament-logic";
import { LeagueStandingsTable, remainingMatchesByParticipant, type StandingLevel } from "@/components/league-standings-table";
import { PublicBreaksPanel } from "@/components/public-breaks-panel";
import { PublicLeagueBoard } from "@/components/public-league-board";
import type { PublicLeague, PublicLeagueParticipant } from "@/lib/sheets/leagues-public";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { DayColumns } from "@/components/day-strip";
import { PublicThemeToggle } from "@/components/public-theme-toggle";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

export function PublicLeagueView({ league }: { league: PublicLeague }) {
  const participantById = new Map(league.participants.map((p) => [p.id, p]));
  function lookup(id: string | null): PublicLeagueParticipant | null {
    return id ? participantById.get(id) ?? null : null;
  }

  // Everything scheduled from the start of this week (Sunday) onward —
  // last week's results already show in the standings below.
  const { startIso } = weekRangeFor(todayIsoTel());
  const districtLabel = new Map(league.districts.map((d) => [d.id, d.label]));
  const scheduled = league.districts
    .flatMap((d) => d.matches)
    .filter((m) => m.scheduled_date !== null && m.scheduled_date >= startIso);

  // The day strip for a set of matches; null when there's nothing scheduled.
  function renderSchedule(matches: typeof scheduled): React.ReactNode | null {
    const days = [...new Set(matches.map((m) => m.scheduled_date as string))].sort();
    if (days.length === 0) return null;
    return (
      <div className="px-4 py-3">
        <DayColumns
          items={days.map((day) => {
            const dayMatches = matches.filter((m) => m.scheduled_date === day);
            return {
              day,
              count: dayMatches.length,
              content: (
                <div className="flex flex-col gap-2">
                  {dayMatches.map((m) => {
                    const played = m.frames_a !== null && m.frames_b !== null;
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm py-1 border-b border-border/30 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <p className="leading-snug">
                            {lookup(m.participant_a_id)?.name ?? "?"} <span className="text-muted-foreground">נגד</span>{" "}
                            {lookup(m.participant_b_id)?.name ?? "?"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{districtLabel.get(m.district_id)}</p>
                        </div>
                        {played ? (
                          <span className="font-medium tabular-nums shrink-0">{m.frames_a} - {m.frames_b}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs shrink-0">טרם שוחק</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ),
            };
          })}
        />
      </div>
    );
  }

  const breakRows = computeBreakTable(
    [...league.participants].sort((a, b) => a.name.localeCompare(b.name, "he")).map((p) => p.id),
    league.breaks,
  );
  const levels: Record<string, StandingLevel> = Object.fromEntries(
    league.participants.map((p) => [p.id, { level: p.level, points: p.levelPoints }]),
  );
  const districtOfParticipant = new Map(
    league.districts.flatMap((d) => d.memberIds.map((id) => [id, d.label] as const)),
  );

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Hero */}
      <div className="relative bg-brand-gradient px-5 py-8 flex flex-col items-center text-center gap-3">
        <PublicThemeToggle className="absolute top-3 left-3" />
        <Image src="/logo.png" alt="" width={52} height={52} className="object-contain" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-white leading-tight">{league.name}</h1>
          <p className="text-xs text-white/60 tracking-wide">האקדמיה לסנוקר של שחר רוברג</p>
        </div>
        {league.completed && (
          <span className="text-xs font-medium text-white/85 border border-white/30 rounded-full px-3 py-1">
            הליגה הסתיימה
          </span>
        )}
      </div>

      <div className="px-4 py-6 flex flex-col gap-8 max-w-6xl mx-auto">
        {league.districts.length > 0 || league.participants.length > 0 ? (
          <PublicLeagueBoard
            schedule={
              renderSchedule(scheduled)
            }
            districts={league.districts.map((district) => {
              const standings = computeLeagueStandings(district.memberIds, district.matches);
              const districtSchedule = renderSchedule(scheduled.filter((m) => m.district_id === district.id));
              // Only matches that already have a result.
              const playedMatches = district.matches.filter((m) => m.frames_a !== null && m.frames_b !== null);
              // Newest first; a result entered without a play date goes last.
              const resultDays = [...new Set(playedMatches.map((m) => m.scheduled_date ?? ""))].sort((a, b) =>
                a === "" ? 1 : b === "" ? -1 : b.localeCompare(a),
              );
              return {
                id: district.id,
                label: district.label,
                schedule: districtSchedule,
                standings: (
                  <LeagueStandingsTable
                    rows={standings}
                    highlightLeader
                    levels={levels}
                    remaining={remainingMatchesByParticipant(district.matches)}
                    // Player pages aren't public yet: names are plain text for now.
                    renderName={(id) => lookup(id)?.name ?? "?"}
                  />
                ),
                rounds:
                  resultDays.length > 0 ? (
                    <div className="flex flex-col gap-3 px-4 pb-3">
                      {resultDays.map((day) => (
                        <div key={day || "none"} className="flex flex-col gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {day ? `${dayLabelHe(day)} · ${shortDate(day)}` : "ללא תאריך"}
                          </p>
                          {playedMatches
                            .filter((m) => (m.scheduled_date ?? "") === day)
                            .map((m) => {
                              const nameA = lookup(m.participant_a_id);
                              const nameB = lookup(m.participant_b_id);
                              return (
                                <div key={m.id} className="flex items-center gap-2 text-sm">
                                  <span className="flex-1 truncate">
                                    {nameA?.name ?? "?"}
                                    {" "}נגד{" "}
                                    {nameB?.name ?? "?"}
                                  </span>
                                  <span className="font-medium tabular-nums">{m.frames_a} - {m.frames_b}</span>
                                </div>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  ) : null,
              };
            })}
            breaks={
              <PublicBreaksPanel
                rows={breakRows}
                names={Object.fromEntries(league.participants.map((p) => [p.id, p.name]))}
                districts={Object.fromEntries(districtOfParticipant)}
              />
            }
          />
        ) : (
          <p className="text-center text-sm text-muted-foreground py-10">הליגה טרם החלה</p>
        )}

        <p className="text-center text-xs text-muted-foreground/60 pt-2">
          האקדמיה לסנוקר של שחר רוברג
        </p>
      </div>
    </div>
  );
}
