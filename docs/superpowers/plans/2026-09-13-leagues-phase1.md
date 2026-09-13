# Leagues Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin/coach can create a league, add districts ("מחוזות"), manually assign participants to districts, generate each district's round-robin fixture schedule (with a configurable number of cycles), enter results, and see each district's standings table. No public page, no student personal-area integration yet (Phases 2-3).

**Architecture:** Mirrors the existing tournaments feature's file structure and patterns as closely as possible: `leagues.ts` (core CRUD + participants, mirrors `tournaments.ts`) and `league-districts.ts` (districts + fixtures + results, mirrors `tournament-houses.ts`). A new pure `generateLeagueRounds` function in `tournament-logic.ts` implements the round-robin "circle method" with support for repeated cycles — the one genuinely new algorithm this feature needs. Rating updates reuse the existing `computeEloUpdate`; standings reuse the existing `computeHouseStandings` untouched.

**Tech Stack:** Next.js API routes, Supabase, TanStack Query, shadcn/ui, Vitest.

See `docs/superpowers/specs/2026-09-13-leagues-design.md` for the full design.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260913_leagues.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Leagues: season-long round-robin competitions, divided into districts
-- ("מחוזות") that each run their own independent schedule and standings
-- table. Mirrors the tournaments schema's conventions exactly (RLS enabled,
-- no policies — service-role access only, via src/lib/sheets/leagues.ts and
-- src/lib/sheets/league-districts.ts).

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  num_cycles INT NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT NOT NULL UNIQUE,
  handicap_points_per_rating_gap INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  district_id UUID REFERENCES league_districts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, student_id)
);

CREATE TABLE league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES league_districts(id) ON DELETE CASCADE,
  round INT NOT NULL,
  participant_a_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES league_participants(id) ON DELETE CASCADE,
  frames_a INT,
  frames_b INT
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
```

Save this to `supabase/migrations/20260913_leagues.sql`. This repo's migrations are applied manually by the user via the Supabase SQL Editor (no local DB connection in this environment) — do not attempt to run it.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260913_leagues.sql
git commit -m "chore(leagues): add leagues/districts/participants/matches migration"
```

---

### Task 2: `generateLeagueRounds` pure logic + tests

**Files:**
- Modify: `src/lib/sheets/tournament-logic.ts`
- Modify: `src/lib/sheets/tournament-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `generateLeagueRounds` to the existing import list in `src/lib/sheets/tournament-logic.test.ts` (add this one name, don't duplicate the import statement):

```ts
import {
  shuffle,
  assignToHouses,
  generateRoundRobinPairs,
  computeHouseStandings,
  computeEloUpdate,
  computeHandicapPoints,
  formatHandicapLabel,
  isValidBracketSize,
  knockoutRoundCount,
  knockoutRoundLabel,
  knockoutMatchWinner,
  computeTournamentPlacement,
  generateLeagueRounds,
} from "./tournament-logic";
```

Add this new `describe` block at the end of the file:

```ts
describe("generateLeagueRounds", () => {
  it("returns nothing for fewer than 2 participants", () => {
    expect(generateLeagueRounds([], 1)).toEqual([]);
    expect(generateLeagueRounds(["p1"], 1)).toEqual([]);
  });

  it("pairs every participant with every other exactly once for a single cycle (even count)", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const fixtures = generateLeagueRounds(ids, 1);
    expect(fixtures).toHaveLength(6); // C(4,2)

    const pairKey = (a: string, b: string) => [a, b].sort().join("-");
    const seen = new Set(fixtures.map((f) => pairKey(f.participantAId, f.participantBId)));
    expect(seen.size).toBe(6); // every pair appears, none repeated

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3])); // n-1 rounds
  });

  it("repeats every pairing exactly numCycles times, with round numbers continuing sequentially", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const fixtures = generateLeagueRounds(ids, 2);
    expect(fixtures).toHaveLength(12); // 6 pairs x 2 cycles

    const pairKey = (a: string, b: string) => [a, b].sort().join("-");
    const counts = new Map<string, number>();
    for (const f of fixtures) {
      const k = pairKey(f.participantAId, f.participantBId);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual(Array(6).fill(2));

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3, 4, 5, 6])); // 2 cycles x 3 rounds, not reset per cycle
  });

  it("handles an odd participant count with a bye — no bye ever appears as a real fixture", () => {
    const ids = ["p1", "p2", "p3"];
    const fixtures = generateLeagueRounds(ids, 1);
    expect(fixtures).toHaveLength(3); // C(3,2)
    for (const f of fixtures) {
      expect(f.participantAId).not.toBeNull();
      expect(f.participantBId).not.toBeNull();
    }
    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds).toEqual(new Set([1, 2, 3])); // one round per participant when odd
  });

  it("never schedules the same participant twice in the same round", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const fixtures = generateLeagueRounds(ids, 1);
    const byRound = new Map<number, string[]>();
    for (const f of fixtures) {
      const list = byRound.get(f.round) ?? [];
      list.push(f.participantAId, f.participantBId);
      byRound.set(f.round, list);
    }
    for (const [, playersInRound] of byRound) {
      expect(new Set(playersInRound).size).toBe(playersInRound.length);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run`
Expected: FAIL — `generateLeagueRounds is not a function` (or similar), since it doesn't exist yet.

- [ ] **Step 3: Implement `generateLeagueRounds`**

Add this to `src/lib/sheets/tournament-logic.ts` (at the end of the file — after `knockoutMatchWinner`):

```ts
export type LeagueFixture = { round: number; participantAId: string; participantBId: string };

/**
 * Schedules a round-robin season for one district: every pair meets exactly
 * `numCycles` times, no participant plays twice in the same round, and
 * round numbers are unique and sequential across the whole district (cycle
 * 2 continues numbering where cycle 1 left off — it does not restart at 1).
 *
 * Standard "circle method": one participant fixed, the rest rotate each
 * round. An odd participant count gets one bye slot per round (dropped,
 * never a real fixture) so the rotation still works.
 */
export function generateLeagueRounds(participantIds: string[], numCycles: number): LeagueFixture[] {
  if (participantIds.length < 2) return [];

  const ids: (string | null)[] = [...participantIds];
  if (ids.length % 2 !== 0) ids.push(null);

  const n = ids.length;
  const roundsPerCycle = n - 1;
  const half = n / 2;
  const fixtures: LeagueFixture[] = [];

  for (let cycle = 0; cycle < numCycles; cycle++) {
    let rotation = [...ids];
    for (let r = 0; r < roundsPerCycle; r++) {
      const round = cycle * roundsPerCycle + r + 1;
      for (let i = 0; i < half; i++) {
        const a = rotation[i];
        const b = rotation[n - 1 - i];
        if (a !== null && b !== null) {
          fixtures.push({ round, participantAId: a, participantBId: b });
        }
      }
      // Keep the first participant fixed, rotate everyone else by one
      // position — the standard circle-method rotation step.
      rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
    }
  }

  return fixtures;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run`
Expected: PASS — all new tests green, all pre-existing tests still green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets/tournament-logic.ts src/lib/sheets/tournament-logic.test.ts
git commit -m "feat(leagues): add generateLeagueRounds round-robin scheduler + tests"
```

---

### Task 3: District data layer — `league-districts.ts`

This is built **before** the core `leagues.ts` module (next task) deliberately: `leagues.ts` needs to reference the `LeagueDistrict` type, and `removeLeagueParticipant` needs to call `districtHasFixtures` — building this file first means that reference resolves cleanly instead of forward-referencing a file that doesn't exist yet. This module is fully self-contained and has no dependency on `leagues.ts` at all.

**Files:**
- Create: `src/lib/sheets/league-districts.ts`

- [ ] **Step 1: Write the file**

```ts
import { db } from "@/lib/db/client";
import { generateLeagueRounds, computeEloUpdate } from "./tournament-logic";

export type LeagueDistrict = { id: string; league_id: string; label: string };

export type LeagueMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};

export type DistrictWithMatches = LeagueDistrict & { matches: LeagueMatch[]; memberIds: string[] };

export async function fetchLeagueDistricts(leagueId: string): Promise<DistrictWithMatches[]> {
  const { data: districts } = await db
    .from("league_districts")
    .select("*")
    .eq("league_id", leagueId)
    .order("label");
  const districtRows = (districts ?? []) as LeagueDistrict[];
  if (!districtRows.length) return [];

  const districtIds = districtRows.map((d) => d.id);
  const { data: matches } = await db.from("league_matches").select("*").in("district_id", districtIds);
  const { data: members } = await db
    .from("league_participants")
    .select("id, district_id")
    .in("district_id", districtIds);

  return districtRows.map((d) => ({
    ...d,
    matches: (matches ?? []).filter((m) => m.district_id === d.id) as LeagueMatch[],
    memberIds: (members ?? []).filter((m) => m.district_id === d.id).map((m) => m.id as string),
  }));
}

export async function districtHasFixtures(districtId: string): Promise<boolean> {
  const { data } = await db.from("league_matches").select("id").eq("district_id", districtId).limit(1);
  return (data ?? []).length > 0;
}

export async function addLeagueDistrict(leagueId: string, label: string): Promise<LeagueDistrict> {
  const { data, error } = await db
    .from("league_districts")
    .insert({ league_id: leagueId, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LeagueDistrict;
}

export async function assignParticipantToDistrict(
  leagueId: string,
  participantId: string,
  districtId: string | null,
): Promise<void> {
  const { data: participant } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.league_id !== leagueId) throw new Error("participant not found");

  if (districtId) {
    const { data: district } = await db
      .from("league_districts")
      .select("id, league_id")
      .eq("id", districtId)
      .maybeSingle();
    if (!district || district.league_id !== leagueId) throw new Error("district not found");
    if (await districtHasFixtures(districtId)) {
      throw new Error("cannot assign a participant into a district whose fixture schedule was already generated");
    }
  }

  if (participant.district_id && (await districtHasFixtures(participant.district_id as string))) {
    throw new Error("cannot move a participant out of a district whose fixture schedule was already generated");
  }

  const { error } = await db
    .from("league_participants")
    .update({ district_id: districtId })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function generateDistrictFixtures(leagueId: string, districtId: string): Promise<void> {
  const { data: district } = await db
    .from("league_districts")
    .select("id, league_id")
    .eq("id", districtId)
    .maybeSingle();
  if (!district || district.league_id !== leagueId) throw new Error("district not found");

  const { data: existingResults } = await db
    .from("league_matches")
    .select("id")
    .eq("district_id", districtId)
    .not("frames_a", "is", null)
    .limit(1);
  if ((existingResults ?? []).length > 0) {
    throw new Error("cannot regenerate a fixture schedule once results have been recorded");
  }

  const { error: deleteError } = await db.from("league_matches").delete().eq("district_id", districtId);
  if (deleteError) throw new Error(deleteError.message);

  const { data: memberRows } = await db
    .from("league_participants")
    .select("id")
    .eq("league_id", leagueId)
    .eq("district_id", districtId);
  const participantIds = (memberRows ?? []).map((m) => m.id as string);
  if (participantIds.length < 2) throw new Error("a district needs at least 2 participants to generate fixtures");

  const { data: league } = await db.from("leagues").select("num_cycles").eq("id", leagueId).maybeSingle();
  const numCycles = (league?.num_cycles as number) ?? 1;

  const fixtures = generateLeagueRounds(participantIds, numCycles);
  const rows = fixtures.map((f) => ({
    district_id: districtId,
    round: f.round,
    participant_a_id: f.participantAId,
    participant_b_id: f.participantBId,
    frames_a: null,
    frames_b: null,
  }));
  if (rows.length) {
    const { error: insertError } = await db.from("league_matches").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
}

export async function enterLeagueMatchResult(
  leagueId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db.from("league_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("match not found");

  const { data: district } = await db
    .from("league_districts")
    .select("id, league_id")
    .eq("id", match.district_id)
    .maybeSingle();
  if (!district || district.league_id !== leagueId) throw new Error("match not found");

  const { error: updateError } = await db
    .from("league_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  const { data: participants } = await db
    .from("league_participants")
    .select("id, student_id")
    .in("id", [match.participant_a_id, match.participant_b_id]);
  const pa = participants?.find((p) => p.id === match.participant_a_id);
  const pb = participants?.find((p) => p.id === match.participant_b_id);
  if (!pa || !pb) return;

  const { data: students } = await db
    .from("students")
    .select("id, rating")
    .in("id", [pa.student_id, pb.student_id]);
  const sa = students?.find((s) => s.id === pa.student_id);
  const sb = students?.find((s) => s.id === pb.student_id);
  if (!sa || !sb) return;

  // Re-entering a corrected result recalculates from whatever the two
  // players' ratings are RIGHT NOW — matching the exact same forward-only,
  // no-retroactive-recalculation rule already established for tournament
  // house/knockout results.
  const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, framesA > framesB);
  const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
  if (ratingAError) throw new Error(ratingAError.message);
  const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
  if (ratingBError) throw new Error(ratingBError.message);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — this module has zero dependency on any other league-specific file, so it typechecks standalone.

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/league-districts.ts
git commit -m "feat(leagues): add district data layer — assignment, fixtures, results"
```

---

### Task 4: Core data layer — `leagues.ts`

**Files:**
- Create: `src/lib/sheets/leagues.ts`

- [ ] **Step 1: Write the file**

```ts
import { db } from "@/lib/db/client";
import { generatePublicSlug } from "./tournaments-slug";
import { districtHasFixtures, type LeagueDistrict } from "./league-districts";

export type League = {
  id: string;
  name: string;
  manager_email: string;
  num_cycles: number;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export type LeagueParticipant = {
  id: string;
  league_id: string;
  student_id: string;
  district_id: string | null;
  created_at: string;
};

export type LeagueParticipantWithStudent = LeagueParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

export type LeagueDetail = {
  league: League;
  participants: LeagueParticipantWithStudent[];
  districts: LeagueDistrict[];
};

export function isLeagueManager(league: League, user: { email: string; role: string }): boolean {
  return user.role === "admin" || league.manager_email.trim().toLowerCase() === user.email.trim().toLowerCase();
}

export async function fetchLeagues(): Promise<League[]> {
  const { data } = await db.from("leagues").select("*").order("created_at", { ascending: false });
  return (data ?? []) as League[];
}

export async function createLeague(input: {
  name: string;
  manager_email: string;
  num_cycles?: number;
  handicap_points_per_rating_gap?: number;
}): Promise<League> {
  const { data, error } = await db
    .from("leagues")
    .insert({
      name: input.name,
      manager_email: input.manager_email,
      num_cycles: input.num_cycles ?? 1,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as League;
}

export async function updateLeague(
  id: string,
  input: { name?: string; manager_email?: string; completed?: boolean },
): Promise<void> {
  const { error } = await db.from("leagues").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchLeagueDetail(id: string): Promise<LeagueDetail | null> {
  const { data: league } = await db.from("leagues").select("*").eq("id", id).maybeSingle();
  if (!league) return null;

  const [{ data: participantRows }, { data: districtRows }] = await Promise.all([
    db.from("league_participants").select("*").eq("league_id", id).order("created_at", { ascending: true }),
    db.from("league_districts").select("*").eq("league_id", id).order("label"),
  ]);

  const participants = (participantRows ?? []) as LeagueParticipant[];
  const studentIds = participants.map((p) => p.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone, rating").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string; rating: number }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    league: league as League,
    participants: participants.map((p) => ({
      ...p,
      student: studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "", rating: 1000 },
    })),
    districts: (districtRows ?? []) as LeagueDistrict[],
  };
}

export async function addLeagueParticipant(
  leagueId: string,
  input: { studentId?: string; newStudentName?: string },
): Promise<LeagueParticipant> {
  const { appendStudent } = await import("./students");
  const { ensurePlayerSlug } = await import("./players");
  let studentId = input.studentId;

  if (!studentId) {
    if (!input.newStudentName?.trim()) throw new Error("studentId or newStudentName required");
    studentId = await appendStudent({
      first_name: input.newStudentName.trim(),
      last_name: "",
      active: false,
      is_tournament_only: true,
      rating: 1000,
      public_slug: generatePublicSlug(),
    });
  } else {
    await ensurePlayerSlug(studentId);
  }

  const { data, error } = await db
    .from("league_participants")
    .insert({ league_id: leagueId, student_id: studentId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("השחקן כבר רשום לליגה הזו");
    throw new Error(error.message);
  }
  return data as LeagueParticipant;
}

export async function removeLeagueParticipant(leagueId: string, participantId: string): Promise<void> {
  const { data: participant } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.league_id !== leagueId) throw new Error("participant not found");

  if (participant.district_id && (await districtHasFixtures(participant.district_id as string))) {
    throw new Error("cannot remove a participant whose district already has a fixture schedule");
  }

  const { error } = await db.from("league_participants").delete().eq("id", participantId).eq("league_id", leagueId);
  if (error) throw new Error(error.message);
}
```

Note this imports `districtHasFixtures` directly and statically from `./league-districts` (not a dynamic `import()`) — unlike the DRY-extraction pattern used elsewhere in this codebase for genuinely circular situations, there's no cycle here: `league-districts.ts` (previous task) has zero dependency on `leagues.ts`, so a plain static import is the simplest correct choice.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/leagues.ts
git commit -m "feat(leagues): add core leagues data layer"
```

---

### Task 5: Core API routes — leagues, participants

**Files:**
- Create: `src/app/api/leagues/route.ts`
- Create: `src/app/api/leagues/[id]/route.ts`
- Create: `src/app/api/leagues/[id]/participants/route.ts`
- Create: `src/app/api/leagues/[id]/participants/[participantId]/route.ts`

- [ ] **Step 1: `src/app/api/leagues/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagues, createLeague } from "@/lib/sheets/leagues";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const leagues = await fetchLeagues();
    return NextResponse.json({ leagues });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1),
  manager_email: z.email(),
  num_cycles: z.number().int().positive().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = CreateSchema.parse(await req.json());
    const activeCoachEmails = await fetchActiveCoachEmails();
    if (!activeCoachEmails.map((e) => e.toLowerCase()).includes(body.manager_email.toLowerCase())) {
      return NextResponse.json({ error: "manager_email must be an active coach" }, { status: 400 });
    }
    const league = await createLeague(body);
    return NextResponse.json({ league });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: `src/app/api/leagues/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, updateLeague, isLeagueManager } from "@/lib/sheets/leagues";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  manager_email: z.email().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = UpdateSchema.parse(await req.json());
    if (user.role !== "admin" && body.manager_email !== undefined) {
      return NextResponse.json({ error: "only an admin can change the manager" }, { status: 403 });
    }
    if (body.manager_email !== undefined) {
      const activeCoachEmails = await fetchActiveCoachEmails();
      if (!activeCoachEmails.map((e) => e.toLowerCase()).includes(body.manager_email.toLowerCase())) {
        return NextResponse.json({ error: "manager_email must be an active coach" }, { status: 400 });
      }
    }
    await updateLeague(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: `src/app/api/leagues/[id]/participants/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, addLeagueParticipant, isLeagueManager } from "@/lib/sheets/leagues";

const AddSchema = z
  .object({
    studentId: z.string().min(1).optional(),
    newStudentName: z.string().min(1).optional(),
  })
  .refine((v) => v.studentId || v.newStudentName, { message: "studentId or newStudentName required" });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = AddSchema.parse(await req.json());
    const participant = await addLeagueParticipant(id, body);
    return NextResponse.json({ participant });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: `src/app/api/leagues/[id]/participants/[participantId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, removeLeagueParticipant, isLeagueManager } from "@/lib/sheets/leagues";
import { assignParticipantToDistrict } from "@/lib/sheets/league-districts";

const AssignSchema = z.object({ districtId: z.string().min(1).nullable() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { districtId } = AssignSchema.parse(await req.json());
    await assignParticipantToDistrict(id, participantId, districtId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await removeLeagueParticipant(id, participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leagues
git commit -m "feat(leagues): add league and participant API routes"
```

---

### Task 6: District API routes — districts, fixtures, results

**Files:**
- Create: `src/app/api/leagues/[id]/districts/route.ts`
- Create: `src/app/api/leagues/[id]/districts/[districtId]/generate/route.ts`
- Create: `src/app/api/leagues/[id]/matches/[matchId]/route.ts`

- [ ] **Step 1: `src/app/api/leagues/[id]/districts/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, isLeagueManager } from "@/lib/sheets/leagues";
import { fetchLeagueDistricts, addLeagueDistrict } from "@/lib/sheets/league-districts";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin" && user.role !== "coach") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const districts = await fetchLeagueDistricts(id);
    return NextResponse.json({ districts });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const AddDistrictSchema = z.object({ label: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { label } = AddDistrictSchema.parse(await req.json());
    const district = await addLeagueDistrict(id, label);
    return NextResponse.json({ district });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: `src/app/api/leagues/[id]/districts/[districtId]/generate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, isLeagueManager } from "@/lib/sheets/leagues";
import { generateDistrictFixtures } from "@/lib/sheets/league-districts";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; districtId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, districtId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await generateDistrictFixtures(id, districtId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: `src/app/api/leagues/[id]/matches/[matchId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, isLeagueManager } from "@/lib/sheets/leagues";
import { enterLeagueMatchResult } from "@/lib/sheets/league-districts";

const ResultSchema = z
  .object({
    framesA: z.number().int().nonnegative(),
    framesB: z.number().int().nonnegative(),
  })
  .refine((v) => v.framesA !== v.framesB, { message: "a match cannot end in a tie" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, matchId } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isLeagueManager(detail.league, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { framesA, framesB } = ResultSchema.parse(await req.json());
    await enterLeagueMatchResult(id, matchId, framesA, framesB);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leagues
git commit -m "feat(leagues): add district, fixture-generation, and result API routes"
```

---

### Task 7: UI — `LeagueParticipantPicker` + `LeagueDistrictsView`

**Files:**
- Create: `src/components/league-participant-picker.tsx`
- Create: `src/components/league-districts-view.tsx`

- [ ] **Step 1: `src/components/league-participant-picker.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

export function LeagueParticipantPicker({ leagueId }: { leagueId: string }) {
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["students:search", query],
    queryFn: async () => {
      const r = await fetch(`/api/students/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("search failed");
      return (await r.json()) as { students: StudentSearchResult[] };
    },
    enabled: query.trim().length >= 2,
  });

  const addMut = useMutation({
    mutationFn: async (body: { studentId?: string; newStudentName?: string }) => {
      const r = await fetch(`/api/leagues/${leagueId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("שחקן נוסף");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: () => toast.error("שגיאה בהוספת שחקן"),
  });

  const results = data?.students ?? [];

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חפש שם או טלפון..."
        dir="auto"
      />
      {query.trim().length >= 2 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {isLoading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">מחפש...</div>
          ) : isError ? (
            <div className="px-3 py-3 text-sm text-destructive text-center">שגיאה בחיפוש, נסה שוב</div>
          ) : (
            <>
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addMut.mutate({ studentId: s.id })}
                  disabled={addMut.isPending}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors text-sm border-b border-border/40 last:border-b-0"
                >
                  <span className="flex-1">{[s.first_name, s.last_name].filter(Boolean).join(" ")}</span>
                  {s.phone && <span className="text-xs text-muted-foreground">{s.phone}</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addMut.mutate({ newStudentName: query.trim() })}
                disabled={addMut.isPending}
                className="w-full text-right px-3 py-2 hover:bg-muted/60 transition-colors text-sm text-primary border-t border-border/40"
              >
                {`+ הוסף כשחקן חדש: "${query.trim()}"`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `src/components/league-districts-view.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type DistrictMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};

type DistrictWithMatches = {
  id: string;
  league_id: string;
  label: string;
  matches: DistrictMatch[];
  memberIds: string[];
};

export function LeagueDistrictsView({
  leagueId,
  participants,
  handicapPointsPerRatingGap,
  canEdit,
}: {
  leagueId: string;
  participants: Participant[];
  handicapPointsPerRatingGap: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["league-districts", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: DistrictWithMatches[] };
    },
  });

  const addDistrictMut = useMutation({
    mutationFn: async (label: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המחוז נוסף");
      setNewLabel("");
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: () => toast.error("שגיאה בהוספת מחוז"),
  });

  const generateMut = useMutation({
    mutationFn: async (districtId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/districts/${districtId}/generate`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("לוח המשחקים נוצר");
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה ביצירת לוח המשחקים"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: () => toast.error("שגיאה בשמירת התוצאה"),
  });

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }
  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  const districts = data?.districts ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">מחוז חדש</label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="למשל: צפון" dir="auto" />
          </div>
          <Button onClick={() => addDistrictMut.mutate(newLabel.trim())} disabled={!newLabel.trim() || addDistrictMut.isPending}>
            <Plus size={14} className="ml-1.5" />
            הוסף מחוז
          </Button>
        </div>
      )}

      {districts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין אין מחוזות
        </div>
      ) : (
        districts.map((district) => {
          const standings = computeHouseStandings(district.memberIds, district.matches);
          const hasFixtures = district.matches.length > 0;
          const rounds = [...new Set(district.matches.map((m) => m.round))].sort((a, b) => a - b);
          return (
            <div key={district.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <p className="text-sm font-semibold">{district.label}</p>
                {canEdit && !hasFixtures && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generateMut.isPending || district.memberIds.length < 2}
                    onClick={() => generateMut.mutate(district.id)}
                  >
                    צור לוח משחקים
                  </Button>
                )}
              </div>

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
                    {standings.map((row, i) => (
                      <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                        <td className="px-4 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5">{participantName(row.participantId)}</td>
                        <td className="text-center px-2 py-1.5">{row.wins}</td>
                        <td className="text-center px-2 py-1.5">{row.framesWon}</td>
                        <td className="text-center px-2 py-1.5">{row.framesLost}</td>
                        <td className="text-center px-2 py-1.5">
                          {row.framesWon - row.framesLost > 0 ? "+" : ""}
                          {row.framesWon - row.framesLost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasFixtures && (
                <div className="flex flex-col gap-3 px-4 py-3 border-t border-border/40">
                  {rounds.map((round) => (
                    <div key={round} className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">מחזור {round}</p>
                      {district.matches
                        .filter((m) => m.round === round)
                        .map((m) => {
                          const nameA = participantName(m.participant_a_id);
                          const nameB = participantName(m.participant_b_id);
                          const handicap = formatHandicapLabel(
                            nameA,
                            participantRating(m.participant_a_id),
                            nameB,
                            participantRating(m.participant_b_id),
                            handicapPointsPerRatingGap,
                          );
                          return (
                            <MatchRow
                              key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                              nameA={nameA}
                              nameB={nameB}
                              handicap={handicap}
                              match={m}
                              canEdit={canEdit}
                              onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                              saving={resultMut.isPending}
                            />
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function MatchRow({
  nameA,
  nameB,
  handicap,
  match,
  canEdit,
  onSave,
  saving,
}: {
  nameA: string;
  nameB: string;
  handicap: string;
  match: DistrictMatch;
  canEdit: boolean;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">{nameA} נגד {nameB}</span>
        {canEdit ? (
          <>
            <Input type="number" min={0} value={framesA} onChange={(e) => setFramesA(e.target.value)} className="h-7 w-14 text-center px-1" />
            <span className="text-muted-foreground">-</span>
            <Input type="number" min={0} value={framesB} onChange={(e) => setFramesB(e.target.value)} className="h-7 w-14 text-center px-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={saving || framesA === "" || framesB === ""}
              onClick={() => onSave(Number(framesA), Number(framesB))}
            >
              שמור
            </Button>
          </>
        ) : played ? (
          <span className="font-medium">{match.frames_a} - {match.frames_b}</span>
        ) : (
          <span className="text-muted-foreground text-xs">טרם שוחק</span>
        )}
      </div>
      {handicap && !played && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/league-participant-picker.tsx src/components/league-districts-view.tsx
git commit -m "feat(leagues): add LeagueParticipantPicker and LeagueDistrictsView"
```

---

### Task 8: `LeagueDetailView`, pages, nav items

**Files:**
- Create: `src/components/league-detail-view.tsx`
- Create: `src/app/(admin)/admin/leagues/page.tsx`
- Create: `src/app/(admin)/admin/leagues/[id]/page.tsx`
- Create: `src/app/(coach)/coach/leagues/page.tsx`
- Create: `src/app/(coach)/coach/leagues/[id]/page.tsx`
- Modify: `src/components/nav-items.ts`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: `src/components/league-detail-view.tsx`**

```tsx
"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Shield, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeagueParticipantPicker } from "@/components/league-participant-picker";
import { LeagueDistrictsView } from "@/components/league-districts-view";

type LeagueParticipant = {
  id: string;
  league_id: string;
  student_id: string;
  district_id: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type LeagueDistrict = { id: string; league_id: string; label: string };

type League = {
  id: string;
  name: string;
  manager_email: string;
  num_cycles: number;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export function LeagueDetailView({
  leagueId,
  backHref,
  currentEmail,
  isAdmin,
}: {
  leagueId: string;
  backHref: string;
  currentEmail: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { league: League; participants: LeagueParticipant[]; districts: LeagueDistrict[] };
    },
  });

  const assignMut = useMutation({
    mutationFn: async ({ participantId, districtId }: { participantId: string; districtId: string | null }) => {
      const r = await fetch(`/api/leagues/${leagueId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ districtId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיוך למחוז"),
  });

  const removeMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("שחקן הוסר");
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
      qc.invalidateQueries({ queryKey: ["league-districts", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בהסרה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const { league, participants, districts } = data;
  const canEdit = isAdmin || league.manager_email.trim().toLowerCase() === currentEmail.trim().toLowerCase();
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/l/${league.public_slug}` : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shield size={20} />}
        title={league.name}
        subtitle={`מנהל: ${league.manager_email}${league.completed ? " · הסתיימה" : ""}`}
        action={
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowRight size={14} />
            חזרה
          </Link>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">קישור ציבורי:</span>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1">
              /l/{league.public_slug}
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מספר סיבובים:</span>
            <span>{league.num_cycles}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מקדם פור:</span>
            <span>{league.handicap_points_per_rating_gap}</span>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">הוספת שחקן</p>
            <LeagueParticipantPicker leagueId={leagueId} />
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
            {`שחקנים (${participants.length})`}
          </p>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין שחקנים עדיין</div>
          ) : (
            <div className="divide-y divide-border/40">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.student.phone || "—"} · דירוג {p.student.rating}
                    </p>
                  </div>
                  {canEdit ? (
                    <Select
                      value={p.district_id ?? "none"}
                      onValueChange={(v) => assignMut.mutate({ participantId: p.id, districtId: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="ללא מחוז" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא מחוז</SelectItem>
                        {districts.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {districts.find((d) => d.id === p.district_id)?.label ?? "ללא מחוז"}
                    </span>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMut.mutate(p.id)}
                      disabled={removeMut.isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <LeagueDistrictsView
          leagueId={leagueId}
          participants={participants}
          handicapPointsPerRatingGap={league.handicap_points_per_rating_gap}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/(admin)/admin/leagues/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Plus, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type League = { id: string; name: string; manager_email: string; completed: boolean };
type Coach = { email: string; name: string; phone: string };

export default function AdminLeaguesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [numCycles, setNumCycles] = useState("1");
  const [handicapGap, setHandicapGap] = useState("20");

  const { data, isLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const r = await fetch("/api/leagues");
      return (await r.json()) as { leagues: League[] };
    },
  });

  const { data: coachData } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      return (await r.json()) as { coaches: Coach[] };
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          manager_email: managerEmail,
          num_cycles: Number(numCycles) || undefined,
          handicap_points_per_rating_gap: Number(handicapGap) || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { league: League };
    },
    onSuccess: ({ league }) => {
      qc.invalidateQueries({ queryKey: ["leagues"] });
      setOpen(false);
      setName("");
      setManagerEmail("");
      setNumCycles("1");
      setHandicapGap("20");
      router.push(`/admin/leagues/${league.id}`);
    },
    onError: () => {},
  });

  const leagues = data?.leagues ?? [];
  const active = leagues.filter((l) => !l.completed);
  const completed = leagues.filter((l) => l.completed);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Shield size={20} />}
        title="ליגות"
        subtitle={isLoading ? "טוען..." : `${leagues.length} ליגות`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus size={14} className="ml-1.5" />
              ליגה חדשה
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ליגה חדשה</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שם הליגה</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">מאמן אחראי</Label>
                  <Select value={managerEmail} onValueChange={(v) => setManagerEmail(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מאמן..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(coachData?.coaches ?? []).map((c) => (
                        <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">מספר סיבובים (1 = כל זוג פעם אחת)</Label>
                  <Input type="number" min={1} value={numCycles} onChange={(e) => setNumCycles(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">מקדם פור (ברירת מחדל 20)</Label>
                  <Input type="number" value={handicapGap} onChange={(e) => setHandicapGap(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
                  ביטול
                </Button>
                <Button onClick={() => createMut.mutate()} disabled={!name.trim() || !managerEmail || createMut.isPending}>
                  {createMut.isPending ? "יוצר..." : "צור"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <LeagueGroup title="פעילות" items={active} basePath="/admin" />
            {completed.length > 0 && <LeagueGroup title="הסתיימו" items={completed} basePath="/admin" />}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueGroup({ title, items, basePath }: { title: string; items: League[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          אין ליגות
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((l) => (
          <Link
            key={l.id}
            href={`${basePath}/leagues/${l.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{l.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/(admin)/admin/leagues/[id]/page.tsx`**

```tsx
import { LeagueDetailView } from "@/components/league-detail-view";

export default async function AdminLeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LeagueDetailView leagueId={id} backHref="/admin/leagues" currentEmail="" isAdmin={true} />
  );
}
```

- [ ] **Step 4: `src/app/(coach)/coach/leagues/page.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Shield, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type League = { id: string; name: string; manager_email: string; completed: boolean };

export default function CoachLeaguesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const r = await fetch("/api/leagues");
      return (await r.json()) as { leagues: League[] };
    },
  });

  const leagues = data?.leagues ?? [];
  const active = leagues.filter((l) => !l.completed);
  const completed = leagues.filter((l) => l.completed);

  return (
    <div className="flex flex-col">
      <PageHeader icon={<Shield size={20} />} title="ליגות" subtitle={isLoading ? "טוען..." : `${leagues.length} ליגות`} />
      <div className="p-4 md:p-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : leagues.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין ליגות</div>
        ) : (
          <>
            <LeagueList title="פעילות" items={active} />
            {completed.length > 0 && <LeagueList title="הסתיימו" items={completed} />}
          </>
        )}
      </div>
    </div>
  );
}

function LeagueList({ title, items }: { title: string; items: League[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((l) => (
          <Link
            key={l.id}
            href={`/coach/leagues/${l.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{l.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/(coach)/coach/leagues/[id]/page.tsx`**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LeagueDetailView } from "@/components/league-detail-view";

export default async function CoachLeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return (
    <LeagueDetailView
      leagueId={id}
      backHref="/coach/leagues"
      currentEmail={session?.user.email ?? ""}
      isAdmin={false}
    />
  );
}
```

- [ ] **Step 6: Add nav items**

In `src/components/nav-items.ts`, add a new entry to `ADMIN_NAV` right after the `tournaments` line, and to `COACH_NAV` right after its `tournaments` line:

```ts
{ href: "/admin/leagues", label: "ליגות", icon: "Shield" },
```
```ts
{ href: "/coach/leagues", label: "ליגות", icon: "Shield" },
```

Do not change any other line in either array.

- [ ] **Step 7: Register the `Shield` icon in `app-shell.tsx`**

In `src/components/app-shell.tsx`, add `Shield` to both the `lucide-react` import list and the `ICON_MAP` object (alphabetically, between `Sparkles` and `Tag`) — same pattern as every other icon already registered there.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/league-detail-view.tsx "src/app/(admin)/admin/leagues" "src/app/(coach)/coach/leagues" src/components/nav-items.ts src/components/app-shell.tsx
git commit -m "feat(leagues): add league detail view, admin/coach pages, nav entries"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full-repo typecheck and test run**

Run:
```bash
npx tsc --noEmit
npm run test:run
```
Expected: both pass with zero errors/failures.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```
