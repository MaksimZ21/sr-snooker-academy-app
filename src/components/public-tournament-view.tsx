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
    <div className="min-h-dvh bg-background px-4 py-6 flex flex-col gap-6 max-w-3xl mx-auto" dir="rtl">
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        {tournament.completed && <p className="text-sm text-muted-foreground">הטורניר הסתיים</p>}
        {tournament.rulesUrl && (
          <a href={tournament.rulesUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
            תקנון הטורניר
          </a>
        )}
      </div>

      {tournament.houses.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">שלב הבתים</h2>
          {tournament.houses.map((house) => {
            const standings = computeHouseStandings(house.memberIds, house.matches);
            return (
              <div key={house.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <p className="text-sm font-semibold px-4 pt-3 pb-2">{house.label}</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/40">
                      <th className="text-right px-4 py-1.5 font-medium">מקום</th>
                      <th className="text-right px-2 py-1.5 font-medium">שם</th>
                      <th className="text-center px-2 py-1.5 font-medium">נצחונות</th>
                      <th className="text-center px-2 py-1.5 font-medium">פרשים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => {
                      const p = lookup(row.participantId);
                      return (
                        <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                          <td className="px-4 py-1.5">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            {p?.publicSlug ? (
                              <a href={`/p/${p.publicSlug}`} className="text-primary underline">{p.name}</a>
                            ) : (
                              p?.name ?? "?"
                            )}
                          </td>
                          <td className="text-center px-2 py-1.5">{row.wins}</td>
                          <td className="text-center px-2 py-1.5">{row.framesWon}-{row.framesLost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </section>
      )}

      {tournament.knockoutMatches.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">שלב הנוקאאוט</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max">
              {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
                <div key={round} className="flex flex-col gap-2 w-56 shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
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
    </div>
  );
}
