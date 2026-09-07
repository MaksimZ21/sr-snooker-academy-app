# Tournaments Phase 4: Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone with a tournament's or player's shareable link view live standings, the knockout bracket, and a player's tournament history — with no login required and no admin/coach-only data (payment status, phone, email) ever exposed. Every participant name on the tournament page links to that player's own public page.

**Architecture:** A new, dedicated data module (`src/lib/sheets/tournaments-public.ts`) defines its own reduced, privacy-safe shapes and fetch functions — deliberately separate from the internal `tournaments.ts`/`tournament-houses.ts`/`tournament-knockout.ts` modules used by the authenticated admin/coach views, so there is no risk of an internal type gaining a new field (phone, `paid`, etc.) and silently leaking onto a public page later. The two pages (`/t/[slug]`, `/p/[slug]`) are plain Next.js server components living outside every route group — no auth check needed at all, since `src/middleware.ts`'s `PROTECTED` list (`/coach`, `/admin`, `/student`) doesn't include `/t` or `/p`. Both pages are pure, read-only renders: no client-side interactivity, no mutations, so neither the pages nor their view components need `"use client"`.

**Tech Stack:** TypeScript, Next.js 16 (App Router, server components), Supabase, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-08-11-tournaments-design.md` — "Public Player Profile" and the `/t/[slug]`/`/p/[slug]` entries under "Navigation & Pages". Builds on Phases 1–3 (foundation, house stage, knockout stage), all already shipped. Reuses `computeHouseStandings`, `knockoutRoundLabel`, `formatHandicapLabel` from `src/lib/sheets/tournament-logic.ts` and the existing `fetchTournamentHouses`/`fetchKnockoutBracket` functions — no new business logic, just new privacy-scoped data fetching and presentation.

**Testing note:** No new pure logic is introduced in this phase (everything reuses already-tested functions from Phase 2/3), so there are no new unit tests to write. `npx tsc --noEmit` and manual verification (visiting the pages as a logged-out browser) are the gates.

---

### Task 1: Public data module

**Files:**
- Create: `src/lib/sheets/tournaments-public.ts`

- [ ] **Step 1: Write the data module**

```ts
import { db } from "@/lib/db/client";
import { fetchTournamentHouses, type HouseWithMatches } from "./tournament-houses";
import { fetchKnockoutBracket, type KnockoutMatch } from "./tournament-knockout";

// Deliberately separate from tournaments.ts/tournament-houses.ts's own
// internal types: these shapes are what's safe to put in front of an
// unauthenticated visitor, and must never gain a field (phone, `paid`,
// email, etc.) just because an internal type happens to. Payment status
// and contact details are never selected from the database here at all,
// not just omitted from the response.

export type PublicParticipant = {
  id: string;
  name: string;
  rating: number;
  publicSlug: string | null;
};

export type PublicTournament = {
  name: string;
  rulesUrl: string | null;
  completed: boolean;
  handicapPointsPerRatingGap: number;
  participants: PublicParticipant[];
  houses: HouseWithMatches[];
  knockoutMatches: KnockoutMatch[];
};

export async function fetchPublicTournament(slug: string): Promise<PublicTournament | null> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, name, rules_url, completed, handicap_points_per_rating_gap")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!tournament) return null;

  const tournamentId = tournament.id as string;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id, student_id")
    .eq("tournament_id", tournamentId);
  const rows = (participantRows ?? []) as { id: string; student_id: string }[];

  const studentIds = rows.map((r) => r.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, rating, public_slug").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; rating: number; public_slug: string | null }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  const participants: PublicParticipant[] = rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      id: r.id,
      name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") : "?",
      rating: (s?.rating as number) ?? 1000,
      publicSlug: (s?.public_slug as string) ?? null,
    };
  });

  const [houses, knockoutMatches] = await Promise.all([
    fetchTournamentHouses(tournamentId),
    fetchKnockoutBracket(tournamentId),
  ]);

  return {
    name: tournament.name as string,
    rulesUrl: (tournament.rules_url as string | null) ?? null,
    completed: tournament.completed as boolean,
    handicapPointsPerRatingGap: tournament.handicap_points_per_rating_gap as number,
    participants,
    houses,
    knockoutMatches,
  };
}

export type PublicPlayerTournament = {
  name: string;
  publicSlug: string;
  completed: boolean;
};

export type PublicPlayer = {
  name: string;
  rating: number;
  tournaments: PublicPlayerTournament[];
};

export async function fetchPublicPlayer(slug: string): Promise<PublicPlayer | null> {
  const { data: student } = await db
    .from("students")
    .select("id, first_name, last_name, rating")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!student) return null;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("tournament_id")
    .eq("student_id", student.id as string);
  const tournamentIds = [...new Set((participantRows ?? []).map((r) => r.tournament_id as string))];

  const { data: tournamentRows } = tournamentIds.length
    ? await db.from("tournaments").select("name, public_slug, completed").in("id", tournamentIds)
    : { data: [] as { name: string; public_slug: string; completed: boolean }[] };

  return {
    name: [student.first_name, student.last_name].filter(Boolean).join(" "),
    rating: student.rating as number,
    tournaments: (tournamentRows ?? []).map((t) => ({
      name: t.name as string,
      publicSlug: t.public_slug as string,
      completed: t.completed as boolean,
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournaments-public.ts
git commit -m "feat(tournaments): add privacy-scoped public data module"
```

---

### Task 2: Public tournament page + view

**Files:**
- Create: `src/components/public-tournament-view.tsx`
- Create: `src/app/t/[slug]/page.tsx`

- [ ] **Step 1: Write `src/components/public-tournament-view.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `src/app/t/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { fetchPublicTournament } from "@/lib/sheets/tournaments-public";
import { PublicTournamentView } from "@/components/public-tournament-view";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await fetchPublicTournament(slug);
  if (!tournament) notFound();
  return <PublicTournamentView tournament={tournament} />;
}
```

This page is deliberately outside every route group (`(admin)`/`(coach)`/`(student)`)
— it lives at `src/app/t/[slug]/page.tsx`, a top-level route, matching how
`src/app/login/page.tsx` already sits outside every group. `src/middleware.ts`'s
`PROTECTED` list is `["/coach", "/admin", "/student"]`, so `/t/*` is never
redirected to `/login` — confirm this yourself by reading
`src/middleware.ts` before writing this task, but do not modify it; no
change is needed there.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/public-tournament-view.tsx "src/app/t/[slug]/page.tsx"
git commit -m "feat(tournaments): add public tournament page"
```

---

### Task 3: Public player page + view

**Files:**
- Create: `src/components/public-player-view.tsx`
- Create: `src/app/p/[slug]/page.tsx`

- [ ] **Step 1: Write `src/components/public-player-view.tsx`**

```tsx
import type { PublicPlayer } from "@/lib/sheets/tournaments-public";

export function PublicPlayerView({ player }: { player: PublicPlayer }) {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 flex flex-col gap-6 max-w-md mx-auto" dir="rtl">
      <div className="text-center flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{player.name}</h1>
        <p className="text-sm text-muted-foreground">דירוג נוכחי: {player.rating}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">טורנירים</h2>
        {player.tournaments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">עדיין לא השתתף/ה בטורנירים</p>
        ) : (
          player.tournaments.map((t) => (
            <a
              key={t.publicSlug}
              href={`/t/${t.publicSlug}`}
              className="rounded-xl border border-border/60 bg-card p-3 flex items-center justify-between text-sm hover:border-primary/40 transition-colors"
            >
              <span className="font-medium">{t.name}</span>
              {t.completed && <span className="text-xs text-muted-foreground">הסתיים</span>}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/p/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { fetchPublicPlayer } from "@/lib/sheets/tournaments-public";
import { PublicPlayerView } from "@/components/public-player-view";

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const player = await fetchPublicPlayer(slug);
  if (!player) notFound();
  return <PublicPlayerView player={player} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/public-player-view.tsx "src/app/p/[slug]/page.tsx"
git commit -m "feat(tournaments): add public player profile page"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this phase adds no new tests, per
the plan header's testing note — everything reused here is already covered).

- [ ] **Step 3: Manual verification (no auth needed for any of this)**

Using a tournament that already has house and/or knockout data (from
earlier phases' manual testing), in a private/incognito browser window (to
guarantee no session cookie):

1. Visit `/t/<that tournament's public_slug>` — confirm it loads with no
   redirect to `/login`, shows the tournament name, rules link (if set),
   house standings tables, and the knockout bracket — all matching what the
   authenticated admin/coach view shows, MINUS any payment status.
2. Confirm no participant's phone number or email appears anywhere on the
   page (view page source / inspect network response if needed — it must
   never even be fetched, not just hidden by CSS).
3. Click a participant's name — confirm it navigates to `/p/<their
   public_slug>` and shows their name, current rating, and a list of every
   tournament they've participated in (including ones other than the one
   you came from, if they've played more than one).
4. From the player page, click one of the listed tournaments — confirm it
   navigates back to that tournament's own public page.
5. Visit `/t/does-not-exist` and `/p/does-not-exist` — confirm both render
   Next.js's standard 404 page rather than crashing or leaking an error.
6. Confirm a tournament with no houses and no knockout bracket yet shows
   "הטורניר טרם החל" instead of two empty sections.

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check, and restate that the players list
(`/admin/players`) and the student personal area (`/student/tournaments`)
remain separate, upcoming phases.

---

## Plan Self-Review Notes

- **Spec coverage:** `/t/[slug]` shows tournament name, rules link, all
  house tables with handicaps, and the knockout bracket with handicaps, no
  payment status, every name links to `/p/[slug]` — all covered by Task 2.
  `/p/[slug]` shows only name, rating, and a list of participated
  tournaments (never phone/email) — covered by Task 3. Both pages require
  no login, per the spec's explicit access model — covered by placing them
  outside every route group and confirming `middleware.ts`'s protected
  list doesn't include `/t` or `/p`.
- **No placeholders:** every step has complete, exact code. (Task 2
  deliberately documents and then corrects a stray leftover line in its own
  Step 1 — this is not a placeholder, it's an explicit self-correction so
  the final file the implementer produces is clean; Step 1b's "in full,
  exactly" block is the authoritative final version of that section.)
- **Privacy scoping enforced at the query level, not just the response
  shape:** `fetchPublicTournament`/`fetchPublicPlayer` never `select()` a
  `phone`, `email`, or `paid` column at all — there is no field to
  accidentally leak later by loosening a response mapper, because the data
  is never fetched from Postgres in the first place.
- **Type consistency:** `PublicParticipant`, `PublicTournament`,
  `PublicPlayerTournament`, `PublicPlayer` are defined once in
  `tournaments-public.ts` (Task 1) and imported (never redefined) by both
  view components (Tasks 2–3). `HouseWithMatches`/`KnockoutMatch` are
  imported from their original modules (`tournament-houses.ts`/
  `tournament-knockout.ts`), not redeclared, since `fetchPublicTournament`
  reuses those modules' own fetch functions directly rather than
  re-querying the same tables itself.
