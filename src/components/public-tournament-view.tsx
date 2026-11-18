"use client";
import { useState, useRef, useLayoutEffect, useCallback } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { computeHouseStandings, knockoutRoundLabel } from "@/lib/sheets/tournament-logic";
import type { PublicTournament, PublicParticipant } from "@/lib/sheets/tournaments-public";
import type { HouseWithMatches } from "@/lib/sheets/tournament-houses";
import { LiveTicker } from "@/components/broadcast";
import { HeroBackdrop } from "@/components/motion/hero-backdrop";
import { IspaBrand } from "@/components/ispa-brand";

// Polled instead of a one-time server fetch so a spectator watching results
// come in sees them without manually refreshing the page. 15s keeps it
// feeling close to live without hammering the server on a page anyone with
// the link can open.
const REFETCH_INTERVAL_MS = 15_000;

export function PublicTournamentView({
  slug,
  initialTournament,
}: {
  slug: string;
  initialTournament: PublicTournament;
}) {
  const { data } = useQuery({
    queryKey: ["public-tournament", slug],
    queryFn: async () => {
      const r = await fetch(`/api/public/tournaments/${slug}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as PublicTournament;
    },
    initialData: initialTournament,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
  const tournament = data;
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const participantById = new Map(tournament.participants.map((p) => [p.id, p]));
  function lookup(id: string | null): PublicParticipant | null {
    return id ? participantById.get(id) ?? null : null;
  }

  const totalRounds = tournament.knockoutMatches.length
    ? Math.max(...tournament.knockoutMatches.map((m) => m.round))
    : 0;

  // Find-yourself search — only meaningful for a multi-location tournament
  // (tournament.locations is only ever non-empty for that type). Narrows
  // down to whole location cards, not individual rows, so a match still
  // sees their entire group's standings and fixtures together.
  const normalizedSearch = search.trim().toLowerCase();
  function locationHasMatch(locationHouses: HouseWithMatches[]): boolean {
    if (!normalizedSearch) return true;
    return locationHouses.some((h) =>
      h.memberIds.some((id) => (lookup(id)?.name ?? "").toLowerCase().includes(normalizedSearch)),
    );
  }

  // Draws the lines connecting a match to the one its winner advances into,
  // measured from real rendered positions (see the same approach in the
  // admin's TournamentKnockoutView) rather than computed from a fixed card
  // height, so it stays correct whatever a card's actual height ends up being.
  const bracketRef = useRef<HTMLDivElement>(null);
  const matchNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectors, setConnectors] = useState<{ id: string; d: string }[]>([]);

  const recomputeConnectors = useCallback(() => {
    const container = bracketRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next: { id: string; d: string }[] = [];
    for (const m of tournament.knockoutMatches) {
      if (!m.next_match_id) continue;
      const fromEl = matchNodeRefs.current.get(m.id);
      const toEl = matchNodeRefs.current.get(m.next_match_id);
      if (!fromEl || !toEl) continue;
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      // RTL layout: round 1 is rendered on the right, later rounds to its
      // left — a match's own left edge faces the match it feeds into.
      const x1 = fromRect.left - containerRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
      const x2 = toRect.right - containerRect.left;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top;
      const midX = (x1 + x2) / 2;
      next.push({ id: m.id, d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}` });
    }
    setConnectors(next);
  }, [tournament.knockoutMatches]);

  useLayoutEffect(() => {
    recomputeConnectors();
    window.addEventListener("resize", recomputeConnectors);
    return () => window.removeEventListener("resize", recomputeConnectors);
  }, [recomputeConnectors]);

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      {/* Hero */}
      <div className="relative isolate overflow-hidden bg-brand-plain px-5 py-10 flex flex-col items-center text-center gap-3">
        <HeroBackdrop />
        {tournament.multiLocation ? (
          // External (multi-location) tournaments run under ISPA's logo.
          <IspaBrand size="lg" />
        ) : (
          <Image src="/logo.png" alt="" width={52} height={52} className="object-contain" />
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="bc-num text-[28px] md:text-[36px] text-white leading-tight">{tournament.name}</h1>
          {!tournament.multiLocation && (
            <p className="text-xs text-white/60 tracking-wide">האקדמיה לסנוקר של שחר רוברג</p>
          )}
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

      {/* Played results running like a sports channel; knockout first, then the houses. */}
      {(() => {
        const played = [
          ...[...tournament.knockoutMatches].sort((a, b) => b.round - a.round),
          ...tournament.houses.flatMap((h) => h.matches),
        ].filter((m) => m.frames_a !== null && m.frames_b !== null && m.participant_a_id && m.participant_b_id);
        if (!played.length) return null;
        return (
          <LiveTicker
            isLoading={false}
            label="תוצאות"
            items={played.slice(0, 30).map((m) => ({
              id: m.id,
              time: `${m.frames_a} - ${m.frames_b}`,
              text: `${lookup(m.participant_a_id)?.name ?? "?"} נגד ${lookup(m.participant_b_id)?.name ?? "?"}`,
            }))}
          />
        );
      })()}

      <div className="px-4 py-6 flex flex-col gap-8 max-w-4xl mx-auto">
        {tournament.houses.length > 0 && (
          <section className="flex flex-col gap-5">
            <h2 className="bc-num text-2xl md:text-3xl">שלב הבתים</h2>
            {tournament.locations.length > 0 ? (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש לפי שם — מצא את המיקום שלך..."
                  dir="auto"
                  className="w-full rounded-[14px] border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {(() => {
                  // One button per location (like the league districts); only
                  // the picked location's houses show. The search narrows the
                  // buttons to locations where that name plays.
                  const visibleLocations = tournament.locations.filter(
                    (location) =>
                      tournament.houses.some((h) => h.location_id === location.id) &&
                      locationHasMatch(tournament.houses.filter((h) => h.location_id === location.id)),
                  );
                  if (visibleLocations.length === 0) {
                    return (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        {normalizedSearch ? "לא נמצאה התאמה" : "עוד אין בתים"}
                      </p>
                    );
                  }
                  const selected = visibleLocations.find((l) => l.id === locationId) ?? visibleLocations[0];
                  const locationHouses = tournament.houses.filter((h) => h.location_id === selected.id);
                  return (
                    <>
                      {visibleLocations.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {visibleLocations.map((location) => (
                            <button
                              key={location.id}
                              type="button"
                              onClick={() => setLocationId(location.id)}
                              aria-pressed={location.id === selected.id}
                              className={cn(
                                "rounded-xl border px-4 py-2 font-display text-sm font-bold transition-colors",
                                location.id === selected.id
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {location.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {visibleLocations.length === 1 && (
                        <h3 className="bc-kicker text-sm text-primary">{selected.label}</h3>
                      )}
                      <div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto md:snap-x md:snap-mandatory md:pb-2">
                        {locationHouses.map((house) => (
                          <div key={house.id} className="md:snap-start md:shrink-0 md:w-[440px]">
                            <HouseCard house={house} lookup={lookup} />
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tournament.houses.map((house) => (
                  <HouseCard key={house.id} house={house} lookup={lookup} />
                ))}
              </div>
            )}
          </section>
        )}

        {tournament.knockoutMatches.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="bc-num text-2xl md:text-3xl">שלב הנוקאאוט</h2>
            <div className="overflow-x-auto">
              <div ref={bracketRef} className="relative flex gap-10 min-w-max">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
                  {connectors.map((c) => (
                    <path key={c.id} d={c.d} fill="none" className="stroke-border" strokeWidth={2} />
                  ))}
                </svg>
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
                  <div key={round} className="relative flex flex-col w-56 shrink-0">
                    <p
                      className={cn(
                        "mx-auto mb-3 rounded-lg px-3 py-1 font-display text-xs font-extrabold",
                        round === totalRounds ? "bg-[#f2b705] text-black" : "bg-sidebar text-white",
                      )}
                    >
                      {knockoutRoundLabel(round, totalRounds)}
                    </p>
                    <div className="flex-1 flex flex-col justify-around gap-6">
                      {tournament.knockoutMatches
                        .filter((m) => m.round === round)
                        .sort((a, b) => a.slot - b.slot)
                        .map((m) => {
                          const pa = lookup(m.participant_a_id);
                          const pb = lookup(m.participant_b_id);
                          const played = m.frames_a !== null && m.frames_b !== null;
                          return (
                            <div
                              key={m.id}
                              ref={(el) => {
                                if (el) matchNodeRefs.current.set(m.id, el);
                                else matchNodeRefs.current.delete(m.id);
                              }}
                              className="rounded-[14px] border bg-card overflow-hidden flex flex-col divide-y shadow-[0_6px_16px_-12px_rgb(13_21_16/0.35)]"
                            >
                              {[
                                { p: pa, score: m.frames_a, other: m.frames_b },
                                { p: pb, score: m.frames_b, other: m.frames_a },
                              ].map(({ p, score, other }, i) => {
                                const won = played && (score as number) > (other as number);
                                return (
                                  <div
                                    key={i}
                                    className={cn(
                                      "flex items-center justify-between gap-2 text-sm px-2.5 py-2 border-s-4",
                                      won ? "border-primary bg-primary/8" : "border-transparent",
                                    )}
                                  >
                                    <span className={cn("flex-1 truncate flex items-center gap-1.5", won ? "font-extrabold" : played ? "text-muted-foreground" : "")}>
                                      {p?.skillLevel && (
                                        <span className="shrink-0 rounded bg-sidebar text-white px-1 font-display text-[11px] font-extrabold leading-5" dir="ltr">
                                          {p.skillLevel}
                                        </span>
                                      )}
                                      <span className="truncate">{p?.name ?? "טרם נקבע"}</span>
                                    </span>
                                    {played && <span className={cn("bc-num text-base leading-none", !won && "text-muted-foreground")}>{score}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {tournament.houses.length === 0 && tournament.knockoutMatches.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">הטורניר טרם החל</p>
        )}

        {!tournament.multiLocation && (
          <p className="text-center text-xs text-muted-foreground/60 pt-2">
            האקדמיה לסנוקר של שחר רוברג
          </p>
        )}
      </div>
    </div>
  );
}

function HouseCard({
  house,
  lookup,
}: {
  house: HouseWithMatches;
  lookup: (id: string | null) => PublicParticipant | null;
}) {
  const standings = computeHouseStandings(house.memberIds, house.matches);
  const played = house.matches.filter((m) => m.frames_a !== null && m.frames_b !== null).length;
  return (
    <div className="rounded-[18px] border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-sidebar text-white px-4 py-3">
        <p className="bc-num text-xl leading-none">{house.label}</p>
        <span className="font-display text-xs font-bold text-white/60">
          {played}/{house.matches.length} משחקים
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] md:text-sm">
          <thead>
            <tr className="text-[11px] md:text-xs text-muted-foreground border-b bg-muted/40">
              <th className="text-center ps-3 pe-1 py-2 font-display font-bold w-10">#</th>
              <th className="text-right px-2 py-2 font-display font-bold">שחקן</th>
              <th className="text-center px-2 py-2 font-display font-bold">נ׳</th>
              <th className="text-center px-2 py-2 font-display font-bold">פריימים</th>
              <th className="text-center px-2 py-2 font-display font-bold">+/-</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const p = lookup(row.participantId);
              const leading = i === 0 && row.wins > 0;
              const diff = row.framesWon - row.framesLost;
              return (
                <tr key={row.participantId} className={cn("border-b border-border/40 last:border-b-0", leading && "bg-primary/8")}>
                  <td className="ps-3 pe-1 py-2 text-center">
                    <span
                      className={cn(
                        "inline-flex w-7 h-7 items-center justify-center rounded-md bc-num text-sm",
                        leading ? "bg-primary text-white" : "text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-2 py-2 max-w-[10rem]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {p?.skillLevel && (
                        <span className="shrink-0 rounded bg-sidebar text-white px-1 font-display text-[11px] font-extrabold leading-5" dir="ltr">
                          {p.skillLevel}
                        </span>
                      )}
                      <span className={cn("truncate", leading ? "font-extrabold" : "font-semibold")}>{p?.name ?? "?"}</span>
                    </span>
                  </td>
                  <td className="text-center px-2 py-2">
                    <span className="bc-num text-base">{row.wins}</span>
                  </td>
                  <td className="text-center px-2 py-2 tabular-nums text-muted-foreground" dir="ltr">
                    {row.framesWon}-{row.framesLost}
                  </td>
                  <td
                    className={cn("text-center px-2 py-2 tabular-nums font-semibold", diff > 0 && "text-emerald-600 dark:text-emerald-400", diff < 0 && "text-destructive")}
                    dir="ltr"
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col divide-y border-t">
        {house.matches.map((m) => {
          const a = lookup(m.participant_a_id);
          const b = lookup(m.participant_b_id);
          const done = m.frames_a !== null && m.frames_b !== null;
          const aWon = done && (m.frames_a as number) > (m.frames_b as number);
          const bWon = done && (m.frames_b as number) > (m.frames_a as number);
          return (
            <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 text-sm">
              <span className={cn("truncate", aWon ? "font-extrabold" : done ? "text-muted-foreground" : "")}>{a?.name ?? "?"}</span>
              {done ? (
                <span className="bc-num text-base rounded-md bg-sidebar text-white px-2 py-0.5 leading-none" dir="rtl">
                  {m.frames_a}-{m.frames_b}
                </span>
              ) : (
                <span className="rounded-md bg-muted px-2 py-0.5 font-display text-[11px] font-bold text-muted-foreground">נגד</span>
              )}
              <span className={cn("truncate text-left", bWon ? "font-extrabold" : done ? "text-muted-foreground" : "")}>{b?.name ?? "?"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
