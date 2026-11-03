import Image from "next/image";
import { computeLeagueStandings, computeBreakTable, formatHandicapLabel } from "@/lib/sheets/tournament-logic";
import { LeagueStandingsTable } from "@/components/league-standings-table";
import { LeagueBreaksTable } from "@/components/league-breaks-table";
import { DistrictSwitcher } from "@/components/district-switcher";
import type { PublicLeague, PublicLeagueParticipant } from "@/lib/sheets/leagues-public";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
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
  const scheduleDays = [...new Set(scheduled.map((m) => m.scheduled_date as string))].sort();

  const breakRows = computeBreakTable(league.breaks);
  const districtOfParticipant = new Map(
    league.districts.flatMap((d) => d.memberIds.map((id) => [id, d.label] as const)),
  );

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Hero */}
      <div className="bg-brand-gradient px-5 py-8 flex flex-col items-center text-center gap-3">
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

      <div className="px-4 py-6 flex flex-col gap-8 max-w-4xl mx-auto">
        {scheduleDays.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">לוז</h2>
            <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
              {scheduleDays.map((day) => (
                <div key={day} className="px-4 py-3 flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {dayLabelHe(day)} · {shortDate(day)}
                  </p>
                  {scheduled
                    .filter((m) => m.scheduled_date === day)
                    .map((m) => {
                      const played = m.frames_a !== null && m.frames_b !== null;
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate">
                            {lookup(m.participant_a_id)?.name ?? "?"} נגד {lookup(m.participant_b_id)?.name ?? "?"}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {districtLabel.get(m.district_id)}
                          </span>
                          {played ? (
                            <span className="font-medium tabular-nums shrink-0">{m.frames_a} - {m.frames_b}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs shrink-0">טרם שוחק</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </section>
        )}
        {league.districts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <DistrictSwitcher
              items={league.districts.map((district) => {
                const standings = computeLeagueStandings(district.memberIds, district.matches);
                const rounds = [...new Set(district.matches.map((m) => m.round))].sort((a, b) => a - b);
                return {
                  id: district.id,
                  label: district.label,
                  content: (
                  <div key={district.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <p className="text-sm font-semibold px-4 pt-3 pb-2">{district.label}</p>
                    <LeagueStandingsTable
                      rows={standings}
                      highlightLeader
                      renderName={(id) => {
                        const p = lookup(id);
                        return p?.publicSlug ? (
                          <a href={`/p/${p.publicSlug}`} className="text-primary underline">{p.name}</a>
                        ) : (
                          p?.name ?? "?"
                        );
                      }}
                    />

                    {rounds.length > 0 && (
                      <div className="flex flex-col gap-3 px-4 py-3 border-t border-border/40">
                        {rounds.map((round) => (
                          <div key={round} className="flex flex-col gap-2">
                            <p className="text-xs font-medium text-muted-foreground">מחזור {round}</p>
                            {district.matches
                              .filter((m) => m.round === round)
                              .map((m) => {
                                const nameA = lookup(m.participant_a_id);
                                const nameB = lookup(m.participant_b_id);
                                const played = m.frames_a !== null && m.frames_b !== null;
                                const handicap =
                                  nameA && nameB
                                    ? formatHandicapLabel(nameA.name, nameA.rating, nameB.name, nameB.rating, league.handicapPointsPerRatingGap)
                                    : "";
                                return (
                                  <div key={m.id} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="flex-1 truncate">
                                        {nameA?.publicSlug ? (
                                          <a href={`/p/${nameA.publicSlug}`} className="text-primary underline">{nameA.name}</a>
                                        ) : (
                                          nameA?.name ?? "?"
                                        )}
                                        {" "}נגד{" "}
                                        {nameB?.publicSlug ? (
                                          <a href={`/p/${nameB.publicSlug}`} className="text-primary underline">{nameB.name}</a>
                                        ) : (
                                          nameB?.name ?? "?"
                                        )}
                                      </span>
                                      {played ? (
                                        <span className="font-medium tabular-nums">{m.frames_a} - {m.frames_b}</span>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">טרם שוחק</span>
                                      )}
                                    </div>
                                    {handicap && !played && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
                                  </div>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ),
                };
              })}
            />
          </section>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-10">הליגה טרם החלה</p>
        )}

        {breakRows.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">טבלת ברייקים</h2>
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <LeagueBreaksTable
                rows={breakRows}
                renderName={(id) => lookup(id)?.name ?? "?"}
                districtOf={(id) => districtOfParticipant.get(id) ?? ""}
              />
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground/60 pt-2">
          האקדמיה לסנוקר של שחר רוברג
        </p>
      </div>
    </div>
  );
}
