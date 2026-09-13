import Image from "next/image";
import { cn } from "@/lib/utils";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";
import type { PublicLeague, PublicLeagueParticipant } from "@/lib/sheets/leagues-public";

export function PublicLeagueView({ league }: { league: PublicLeague }) {
  const participantById = new Map(league.participants.map((p) => [p.id, p]));
  function lookup(id: string | null): PublicLeagueParticipant | null {
    return id ? participantById.get(id) ?? null : null;
  }

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
        {league.districts.length > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {league.districts.map((district) => {
                const standings = computeHouseStandings(district.memberIds, district.matches);
                const rounds = [...new Set(district.matches.map((m) => m.round))].sort((a, b) => a - b);
                return (
                  <div key={district.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <p className="text-sm font-semibold px-4 pt-3 pb-2">{district.label}</p>
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
                );
              })}
            </div>
          </section>
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
