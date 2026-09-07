import Image from "next/image";
import { cn } from "@/lib/utils";
import { computeHouseStandings, knockoutRoundLabel, formatHandicapLabel } from "@/lib/sheets/tournament-logic";
import type { PublicTournament, PublicParticipant } from "@/lib/sheets/tournaments-public";

export function PublicTournamentView({ tournament }: { tournament: PublicTournament }) {
  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  function lookup(id: string | null): PublicParticipant | null {
    return id ? participantById.get(id) ?? null : null;
  }

  const totalRounds = tournament.knockoutMatches.length
    ? Math.max(...tournament.knockoutMatches.map((m) => m.round))
    : 0;

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Hero */}
      <div className="bg-brand-gradient px-5 py-8 flex flex-col items-center text-center gap-3">
        <Image src="/logo.png" alt="" width={52} height={52} className="object-contain" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-white leading-tight">{tournament.name}</h1>
          <p className="text-xs text-white/60 tracking-wide">האקדמיה לסנוקר של שחר רוברג</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {tournament.completed && (
            <span className="text-xs font-medium text-white/85 border border-white/30 rounded-full px-3 py-1">
              הטורניר הסתיים
            </span>
          )}
          {tournament.rulesUrl && (
            <a
              href={tournament.rulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-white border border-white/40 rounded-full px-3 py-1 hover:bg-white/10 transition-colors"
            >
              תקנון הטורניר
            </a>
          )}
        </div>
      </div>

      <div className="px-4 py-6 flex flex-col gap-8 max-w-4xl mx-auto">
        {tournament.houses.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">שלב הבתים</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournament.houses.map((house) => {
                const standings = computeHouseStandings(house.memberIds, house.matches);
                return (
                  <div key={house.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <p className="text-sm font-semibold px-4 pt-3 pb-2">{house.label}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-border/40">
                            <th className="text-right px-4 py-1.5 font-medium">מקום</th>
                            <th className="text-right px-2 py-1.5 font-medium">שם</th>
                            <th className="text-center px-2 py-1.5 font-medium">נצחונות</th>
                            <th className="text-center px-2 py-1.5 font-medium">פריימים לטובה</th>
                            <th className="text-center px-2 py-1.5 font-medium">פריימים לרעה</th>
                            <th className="text-center px-2 py-1.5 font-medium">הפרש</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => {
                            const p = lookup(row.participantId);
                            const leading = i === 0;
                            return (
                              <tr
                                key={row.participantId}
                                className={cn("border-b border-border/20 last:border-b-0", leading && "bg-primary/5")}
                              >
                                <td className={cn("px-4 py-1.5", leading && "font-semibold text-primary")}>{i + 1}</td>
                                <td className={cn("px-2 py-1.5 max-w-[9rem] truncate", leading && "font-semibold")}>
                                  {p?.publicSlug ? (
                                    <a href={`/p/${p.publicSlug}`} className="text-primary underline">{p.name}</a>
                                  ) : (
                                    p?.name ?? "?"
                                  )}
                                </td>
                                <td className="text-center px-2 py-1.5 tabular-nums">{row.wins}</td>
                                <td className="text-center px-2 py-1.5 tabular-nums">{row.framesWon}</td>
                                <td className="text-center px-2 py-1.5 tabular-nums">{row.framesLost}</td>
                                <td className="text-center px-2 py-1.5 tabular-nums">
                                  {row.framesWon - row.framesLost > 0 ? "+" : ""}
                                  {row.framesWon - row.framesLost}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col gap-2 px-4 py-3 border-t border-border/40">
                      {house.matches.map((m) => {
                        const nameA = lookup(m.participant_a_id);
                        const nameB = lookup(m.participant_b_id);
                        const played = m.frames_a !== null && m.frames_b !== null;
                        const handicap =
                          nameA && nameB
                            ? formatHandicapLabel(nameA.name, nameA.rating, nameB.name, nameB.rating, tournament.handicapPointsPerRatingGap)
                            : "";
                        return (
                          <div key={m.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="flex-1 truncate">{nameA?.name ?? "?"} נגד {nameB?.name ?? "?"}</span>
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
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tournament.knockoutMatches.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">שלב הנוקאאוט</h2>
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
                  <div key={round} className="flex flex-col gap-2 w-56 shrink-0">
                    <p className="text-xs font-semibold text-muted-foreground text-center">
                      {knockoutRoundLabel(round, totalRounds)}
                    </p>
                    {tournament.knockoutMatches
                      .filter((m) => m.round === round)
                      .sort((a, b) => a.slot - b.slot)
                      .map((m) => {
                        const pa = lookup(m.participant_a_id);
                        const pb = lookup(m.participant_b_id);
                        const played = m.frames_a !== null && m.frames_b !== null;
                        const handicap =
                          pa && pb
                            ? formatHandicapLabel(pa.name, pa.rating, pb.name, pb.rating, tournament.handicapPointsPerRatingGap)
                            : "";
                        return (
                          <div key={m.id} className="rounded-xl border border-border/60 bg-card p-2.5 flex flex-col gap-1.5">
                            {[
                              { p: pa, score: m.frames_a },
                              { p: pb, score: m.frames_b },
                            ].map(({ p, score }, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                                {p?.publicSlug ? (
                                  <a href={`/p/${p.publicSlug}`} className="flex-1 truncate text-primary underline">{p.name}</a>
                                ) : (
                                  <span className="flex-1 truncate">{p?.name ?? "TBD"}</span>
                                )}
                                {played && <span className="font-medium tabular-nums">{score}</span>}
                              </div>
                            ))}
                            {handicap && !played && <p className="text-[10px] text-muted-foreground pt-0.5">{handicap}</p>}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tournament.houses.length === 0 && tournament.knockoutMatches.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">הטורניר טרם החל</p>
        )}

        <p className="text-center text-xs text-muted-foreground/60 pt-2">
          האקדמיה לסנוקר של שחר רוברג
        </p>
      </div>
    </div>
  );
}
