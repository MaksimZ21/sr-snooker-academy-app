# Leagues Phase 2 — Public League Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the public, no-login `/l/[slug]` page for leagues, showing every district's standings table and round-grouped fixture list, mirroring the existing public tournament page (`/t/[slug]`) in spirit and structure.

**Architecture:** One new public-safe data-composition module (`src/lib/sheets/leagues-public.ts`), one new presentational component (`src/components/public-league-view.tsx`), one thin server-component page (`src/app/l/[slug]/page.tsx`). No new tables, no new API routes — this reads directly from Supabase via the service-role `db` client, same pattern as `tournaments-public.ts` / `/t/[slug]`.

**Tech Stack:** Next.js 16 App Router (server component), TypeScript strict mode, Tailwind CSS v4, Supabase.

---

### Task 1: Public league data layer

**Files:**
- Create: `src/lib/sheets/leagues-public.ts`

- [ ] **Step 1: Write `fetchPublicLeague`**

```ts
import { db } from "@/lib/db/client";
import { fetchLeagueDistricts, type DistrictWithMatches } from "./league-districts";

// Deliberately separate from leagues.ts's own internal types, mirroring the
// same isolation `tournaments-public.ts` keeps from `tournaments.ts`: these
// shapes are what's safe to put in front of an unauthenticated visitor, and
// must never gain a field (phone, email, manager_email, etc.) just because
// an internal type happens to. Phone/manager details are never selected
// from the database here at all, not just omitted from the response.
//
// Caveat: this isolation only covers this file's own two queries below.
// `fetchLeagueDistricts` (imported from the authenticated module) does
// `select("*")` against league_districts/league_matches. Those tables are
// purely structural today (ids, labels, rounds, slots, frame scores) with
// nothing sensitive on them, so reusing it here is safe — but if either
// table ever gains a column not meant for public eyes, it would flow onto
// this public page with no line in this file for a reviewer to notice.
// Re-audit this file if those tables' schemas change.

export type PublicLeagueParticipant = {
  id: string;
  name: string;
  rating: number;
  publicSlug: string | null;
};

export type PublicLeague = {
  name: string;
  completed: boolean;
  handicapPointsPerRatingGap: number;
  participants: PublicLeagueParticipant[];
  districts: DistrictWithMatches[];
};

export async function fetchPublicLeague(slug: string): Promise<PublicLeague | null> {
  const { data: league } = await db
    .from("leagues")
    .select("id, name, completed, handicap_points_per_rating_gap")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!league) return null;

  const leagueId = league.id as string;

  const { data: participantRows } = await db
    .from("league_participants")
    .select("id, student_id")
    .eq("league_id", leagueId);
  const rows = (participantRows ?? []) as { id: string; student_id: string }[];

  const studentIds = rows.map((r) => r.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, rating, public_slug").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; rating: number; public_slug: string | null }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  const participants: PublicLeagueParticipant[] = rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      id: r.id,
      name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "?",
      rating: (s?.rating as number) ?? 1000,
      publicSlug: (s?.public_slug as string) ?? null,
    };
  });

  const districts = await fetchLeagueDistricts(leagueId);

  return {
    name: league.name as string,
    completed: league.completed as boolean,
    handicapPointsPerRatingGap: league.handicap_points_per_rating_gap as number,
    participants,
    districts,
  };
}
```

No test file for this — matches the established precedent that `tournaments-public.ts` (the module this mirrors) has no dedicated test file either; it's a thin DB-composition layer, not pure logic, and integration coverage would require a live Supabase instance which this project's test setup doesn't provide.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/leagues-public.ts
git commit -m "feat(leagues): add public-safe league data layer"
```

---

### Task 2: Public league view component and page

**Files:**
- Create: `src/components/public-league-view.tsx`
- Create: `src/app/l/[slug]/page.tsx`

- [ ] **Step 1: `src/components/public-league-view.tsx`**

```tsx
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
```

- [ ] **Step 2: `src/app/l/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { fetchPublicLeague } from "@/lib/sheets/leagues-public";
import { PublicLeagueView } from "@/components/public-league-view";

export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await fetchPublicLeague(slug);
  if (!league) notFound();
  return <PublicLeagueView league={league} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass (this task adds no new tests, matching the untested-by-design `PublicTournamentView`/`/t/[slug]` precedent).

- [ ] **Step 5: Commit**

```bash
git add src/components/public-league-view.tsx "src/app/l/[slug]"
git commit -m "feat(leagues): add public /l/[slug] page"
```

---

### Task 3: Final verification and push

- [ ] **Step 1: Full-repo typecheck and test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 2: Push**

```bash
git push origin main
```
