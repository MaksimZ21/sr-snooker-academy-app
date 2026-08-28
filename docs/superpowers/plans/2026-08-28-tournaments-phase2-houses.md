# Tournaments Phase 2: House Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the tournament manager (or admin) run a random house draw over the tournament's participants, enter round-robin match results (which immediately update both players' ELO ratings), see live standings per house, move a participant to a different house, and re-draw (immediately if nothing's been played yet, with a confirmation if results already exist). Every displayed pairing shows the computed handicap. Knockout brackets, public pages, the players list, and the student personal area remain out of scope — later phases.

**Architecture:** Two new tables (`tournament_houses`, `tournament_house_matches`) plus a `house_id` column on `tournament_participants`. All the actual math (shuffling, round-robin pairing, standings ranking, ELO, handicap) lives in pure, unit-tested functions in a new `src/lib/sheets/tournament-logic.ts` — the only file in this phase with test coverage, matching this codebase's existing convention of testing pure logic and nothing else. A new `src/lib/sheets/tournament-houses.ts` data module wraps those pure functions with the actual Supabase reads/writes, re-verifying every mutation is scoped to the tournament in the URL (the same IDOR class of bug found and fixed in Phase 1 — this plan bakes the fix in from the start instead of relying on review to catch it again).

**Tech Stack:** TypeScript, Next.js 16, Supabase, Zod, TanStack Query, React 19, Tailwind CSS v4, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-tournaments-design.md` — this plan covers "Rating System (ELO)", "Handicap (\"פור\") Display", "Tournament Draw (House Stage Setup)", and "House Stage — Results & Standings". Builds on Phase 1 (`docs/superpowers/plans/2026-08-28-tournaments-phase1-foundation.md`, already shipped).

**Testing note:** Unlike Phase 1, this phase DOES include real unit tests — `tournament-logic.ts` is pure, deterministic (aside from `shuffle`, whose test only checks it's a permutation, not a specific order) business logic with no I/O, exactly the kind of file this codebase already tests (see `src/lib/date.test.ts`). Everything else (data module, API routes, UI) still has no test coverage per established convention — `npx tsc --noEmit` and `npm run test:run` remain the automated gates. The migration is applied manually by the user via the Supabase SQL Editor.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260828_tournament_houses.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE tournament_houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

CREATE TABLE tournament_house_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID NOT NULL REFERENCES tournament_houses(id) ON DELETE CASCADE,
  participant_a_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
  frames_a INT,
  frames_b INT
);

ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES tournament_houses(id) ON DELETE SET NULL;

ALTER TABLE tournament_houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_house_matches ENABLE ROW LEVEL SECURITY;
```

`house_id`'s `ON DELETE SET NULL` matters: re-drawing deletes the tournament's
existing `tournament_houses` rows (cascading their `tournament_house_matches`
too), and every participant who was in one of those houses must fall back to
`NULL` rather than blocking the delete or leaving a dangling reference.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260828_tournament_houses.sql
git commit -m "feat(tournaments): add house stage schema migration"
```

- [ ] **Step 3: Note for the user**

Flag clearly in your final report that the user must run this migration
manually in the Supabase SQL Editor before this phase's features work.

---

### Task 2: Pure tournament logic + tests

**Files:**
- Create: `src/lib/sheets/tournament-logic.ts`
- Create: `src/lib/sheets/tournament-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  shuffle,
  assignToHouses,
  generateRoundRobinPairs,
  computeHouseStandings,
  computeEloUpdate,
  computeHandicapPoints,
  formatHandicapLabel,
} from "./tournament-logic";

describe("shuffle", () => {
  it("returns a permutation of the input, not a mutation of it", () => {
    const input = ["a", "b", "c", "d", "e"];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([...input].sort());
    expect(input).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("assignToHouses", () => {
  it("splits participants into houses with the remainder in the first houses", () => {
    const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const houses = assignToHouses(ids, 4);
    expect(houses).toHaveLength(4);
    expect(houses.map((h) => h.length).sort((a, b) => b - a)).toEqual([4, 4, 3, 3]);
    expect(houses.flat().sort()).toEqual([...ids].sort());
  });

  it("handles an exact division with no remainder", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const houses = assignToHouses(ids, 4);
    expect(houses.map((h) => h.length)).toEqual([3, 3, 3, 3]);
  });
});

describe("generateRoundRobinPairs", () => {
  it("pairs every participant with every other participant exactly once", () => {
    const pairs = generateRoundRobinPairs(["a", "b", "c", "d"]);
    expect(pairs).toHaveLength(6);
    expect(pairs).toEqual([
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ]);
  });

  it("returns no pairs for a single participant", () => {
    expect(generateRoundRobinPairs(["a"])).toEqual([]);
  });
});

describe("computeHouseStandings", () => {
  it("ranks by wins, then frame difference, then frames won", () => {
    const standings = computeHouseStandings(["a", "b", "c"], [
      { participant_a_id: "a", participant_b_id: "b", frames_a: 3, frames_b: 1 },
      { participant_a_id: "a", participant_b_id: "c", frames_a: 3, frames_b: 2 },
      { participant_a_id: "b", participant_b_id: "c", frames_a: 3, frames_b: 0 },
    ]);
    expect(standings.map((s) => s.participantId)).toEqual(["a", "b", "c"]);
    expect(standings[0]).toEqual({ participantId: "a", wins: 2, framesWon: 6, framesLost: 3 });
  });

  it("excludes unplayed matches from the computation", () => {
    const standings = computeHouseStandings(["a", "b"], [
      { participant_a_id: "a", participant_b_id: "b", frames_a: null, frames_b: null },
    ]);
    expect(standings).toEqual([
      { participantId: "a", wins: 0, framesWon: 0, framesLost: 0 },
      { participantId: "b", wins: 0, framesWon: 0, framesLost: 0 },
    ]);
  });
});

describe("computeEloUpdate", () => {
  it("gives the winner more rating and the loser less, symmetrically", () => {
    const { newRatingA, newRatingB } = computeEloUpdate(1000, 1000, true);
    expect(newRatingA).toBe(1016);
    expect(newRatingB).toBe(984);
  });

  it("a big underdog winning gains more than an even match winner", () => {
    const evenWin = computeEloUpdate(1000, 1000, true);
    const underdogWin = computeEloUpdate(800, 1200, true);
    expect(underdogWin.newRatingA - 800).toBeGreaterThan(evenWin.newRatingA - 1000);
  });
});

describe("computeHandicapPoints", () => {
  it("returns positive when the first player is stronger", () => {
    expect(computeHandicapPoints(1100, 1000, 20)).toBe(5);
  });
  it("returns negative when the second player is stronger", () => {
    expect(computeHandicapPoints(1000, 1100, 20)).toBe(-5);
  });
  it("returns 0 for equal ratings", () => {
    expect(computeHandicapPoints(1000, 1000, 20)).toBe(0);
  });
});

describe("formatHandicapLabel", () => {
  it("names the stronger player as the one giving points", () => {
    expect(formatHandicapLabel("דני", 1100, "יוסי", 1000, 20)).toBe("דני נותן/ת ליוסי 5 נקודות");
    expect(formatHandicapLabel("דני", 1000, "יוסי", 1100, 20)).toBe("יוסי נותן/ת לדני 5 נקודות");
  });
  it("returns an empty string when there's no handicap", () => {
    expect(formatHandicapLabel("דני", 1000, "יוסי", 1000, 20)).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/lib/sheets/tournament-logic.test.ts`
Expected: FAIL — `tournament-logic.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
const ELO_K = 32;

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignToHouses(participantIds: string[], numHouses: number): string[][] {
  const shuffled = shuffle(participantIds);
  const houses: string[][] = Array.from({ length: numHouses }, () => []);
  shuffled.forEach((id, i) => houses[i % numHouses].push(id));
  return houses;
}

export function generateRoundRobinPairs(participantIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      pairs.push([participantIds[i], participantIds[j]]);
    }
  }
  return pairs;
}

export type HouseStandingRow = { participantId: string; wins: number; framesWon: number; framesLost: number };

export function computeHouseStandings(
  participantIds: string[],
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[],
): HouseStandingRow[] {
  const rows = new Map<string, HouseStandingRow>(
    participantIds.map((id) => [id, { participantId: id, wins: 0, framesWon: 0, framesLost: 0 }]),
  );
  for (const m of matches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    const a = rows.get(m.participant_a_id);
    const b = rows.get(m.participant_b_id);
    if (!a || !b) continue;
    a.framesWon += m.frames_a;
    a.framesLost += m.frames_b;
    b.framesWon += m.frames_b;
    b.framesLost += m.frames_a;
    if (m.frames_a > m.frames_b) a.wins += 1;
    else if (m.frames_b > m.frames_a) b.wins += 1;
  }
  return [...rows.values()].sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const xDiff = x.framesWon - x.framesLost;
    const yDiff = y.framesWon - y.framesLost;
    if (yDiff !== xDiff) return yDiff - xDiff;
    return y.framesWon - x.framesWon;
  });
}

export function computeEloUpdate(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): { newRatingA: number; newRatingB: number } {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const scoreA = aWon ? 1 : 0;
  const scoreB = aWon ? 0 : 1;
  return {
    newRatingA: Math.round(ratingA + ELO_K * (scoreA - expectedA)),
    newRatingB: Math.round(ratingB + ELO_K * (scoreB - expectedB)),
  };
}

export function computeHandicapPoints(ratingA: number, ratingB: number, pointsPerGap: number): number {
  return Math.round((ratingA - ratingB) / pointsPerGap);
}

export function formatHandicapLabel(
  nameA: string,
  ratingA: number,
  nameB: string,
  ratingB: number,
  pointsPerGap: number,
): string {
  const diff = computeHandicapPoints(ratingA, ratingB, pointsPerGap);
  if (diff === 0) return "";
  if (diff > 0) return `${nameA} נותן/ת ל${nameB} ${diff} נקודות`;
  return `${nameB} נותן/ת ל${nameA} ${-diff} נקודות`;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run src/lib/sheets/tournament-logic.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets/tournament-logic.ts src/lib/sheets/tournament-logic.test.ts
git commit -m "feat(tournaments): add pure house-draw, standings, ELO, and handicap logic"
```

---

### Task 3: `tournament-houses.ts` data module

**Files:**
- Create: `src/lib/sheets/tournament-houses.ts`

- [ ] **Step 1: Write the data module**

```ts
import { db } from "@/lib/db/client";
import {
  assignToHouses,
  generateRoundRobinPairs,
  computeEloUpdate,
} from "./tournament-logic";

export type House = { id: string; tournament_id: string; label: string };
export type HouseMatch = {
  id: string;
  house_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};
export type HouseWithMatches = House & { matches: HouseMatch[]; memberIds: string[] };

export async function fetchTournamentHouses(tournamentId: string): Promise<HouseWithMatches[]> {
  const { data: houses } = await db
    .from("tournament_houses")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("label");
  const houseRows = (houses ?? []) as House[];
  if (!houseRows.length) return [];

  const houseIds = houseRows.map((h) => h.id);
  const { data: matches } = await db.from("tournament_house_matches").select("*").in("house_id", houseIds);
  const { data: members } = await db.from("tournament_participants").select("id, house_id").in("house_id", houseIds);

  return houseRows.map((h) => ({
    ...h,
    matches: (matches ?? []).filter((m) => m.house_id === h.id) as HouseMatch[],
    memberIds: (members ?? []).filter((m) => m.house_id === h.id).map((m) => m.id as string),
  }));
}

export async function hasAnyHouseResult(tournamentId: string): Promise<boolean> {
  const { data: houses } = await db.from("tournament_houses").select("id").eq("tournament_id", tournamentId);
  const houseIds = (houses ?? []).map((h) => h.id as string);
  if (!houseIds.length) return false;
  const { data: played } = await db
    .from("tournament_house_matches")
    .select("id")
    .in("house_id", houseIds)
    .not("frames_a", "is", null)
    .limit(1);
  return (played ?? []).length > 0;
}

export async function runHouseDraw(tournamentId: string, numHouses: number): Promise<void> {
  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id")
    .eq("tournament_id", tournamentId);
  const participantIds = (participantRows ?? []).map((p) => p.id as string);
  if (participantIds.length === 0) throw new Error("no participants to draw");
  if (numHouses > participantIds.length) throw new Error("numHouses cannot exceed participant count");

  // Deleting existing houses cascades their tournament_house_matches and
  // (via ON DELETE SET NULL on tournament_participants.house_id) frees up
  // every participant who was in one of them — this is what makes calling
  // this same function again a safe "re-draw", not just an initial draw.
  const { error: deleteError } = await db.from("tournament_houses").delete().eq("tournament_id", tournamentId);
  if (deleteError) throw new Error(deleteError.message);

  const groups = assignToHouses(participantIds, numHouses);

  for (let i = 0; i < groups.length; i++) {
    const { data: house, error: houseError } = await db
      .from("tournament_houses")
      .insert({ tournament_id: tournamentId, label: `בית ${i + 1}` })
      .select()
      .single();
    if (houseError) throw new Error(houseError.message);
    const houseId = house.id as string;
    const memberIds = groups[i];

    if (memberIds.length) {
      const { error: assignError } = await db
        .from("tournament_participants")
        .update({ house_id: houseId })
        .in("id", memberIds);
      if (assignError) throw new Error(assignError.message);
    }

    const pairs = generateRoundRobinPairs(memberIds).map(([a, b]) => ({
      house_id: houseId,
      participant_a_id: a,
      participant_b_id: b,
      frames_a: null,
      frames_b: null,
    }));
    if (pairs.length) {
      const { error: matchError } = await db.from("tournament_house_matches").insert(pairs);
      if (matchError) throw new Error(matchError.message);
    }
  }
}

export async function moveParticipantToHouse(
  tournamentId: string,
  participantId: string,
  newHouseId: string,
): Promise<void> {
  const { data: house } = await db
    .from("tournament_houses")
    .select("id, tournament_id")
    .eq("id", newHouseId)
    .maybeSingle();
  if (!house || house.tournament_id !== tournamentId) throw new Error("house not found");

  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // A participant only ever belongs to one house at a time, so removing
  // every house match they're currently in (regardless of which house)
  // correctly clears their old house's fixtures before re-pairing them.
  const { error: deleteError } = await db
    .from("tournament_house_matches")
    .delete()
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);
  if (deleteError) throw new Error(deleteError.message);

  const { error: updateError } = await db
    .from("tournament_participants")
    .update({ house_id: newHouseId })
    .eq("id", participantId);
  if (updateError) throw new Error(updateError.message);

  const { data: houseMates } = await db
    .from("tournament_participants")
    .select("id")
    .eq("house_id", newHouseId)
    .neq("id", participantId);

  const pairs = (houseMates ?? []).map((m) => ({
    house_id: newHouseId,
    participant_a_id: participantId,
    participant_b_id: m.id as string,
    frames_a: null,
    frames_b: null,
  }));
  if (pairs.length) {
    const { error: insertError } = await db.from("tournament_house_matches").insert(pairs);
    if (insertError) throw new Error(insertError.message);
  }
}

export async function enterHouseMatchResult(
  tournamentId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db.from("tournament_house_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) throw new Error("match not found");

  const { data: house } = await db
    .from("tournament_houses")
    .select("id, tournament_id")
    .eq("id", match.house_id)
    .maybeSingle();
  if (!house || house.tournament_id !== tournamentId) throw new Error("match not found");

  const { error: updateError } = await db
    .from("tournament_house_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  const { data: participants } = await db
    .from("tournament_participants")
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
  // players' ratings are RIGHT NOW, not the ratings at the time of the
  // original entry — matching the spec's explicit "no retroactive
  // recalculation" rule (every save is a fresh, forward-only ELO update).
  const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, framesA > framesB);
  const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
  if (ratingAError) throw new Error(ratingAError.message);
  const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
  if (ratingBError) throw new Error(ratingBError.message);
}
```

Every mutation here takes `tournamentId` as its first argument and verifies
the house/match/participant it's about to touch actually belongs to that
tournament before doing anything — the same fix applied retroactively in
Phase 1 after an IDOR was found in review, built in from the start this
time.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournament-houses.ts
git commit -m "feat(tournaments): add house draw/move/result data module"
```

---

### Task 4: API routes — houses

**Files:**
- Create: `src/app/api/tournaments/[id]/houses/route.ts`
- Create: `src/app/api/tournaments/[id]/houses/draw/route.ts`
- Create: `src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts`
- Create: `src/app/api/tournaments/[id]/houses/matches/[matchId]/route.ts`

- [ ] **Step 1: Write `src/app/api/tournaments/[id]/houses/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentHouses, hasAnyHouseResult } from "@/lib/sheets/tournament-houses";

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
    const [houses, hasAnyResult] = await Promise.all([fetchTournamentHouses(id), hasAnyHouseResult(id)]);
    return NextResponse.json({ houses, hasAnyResult });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/tournaments/[id]/houses/draw/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { runHouseDraw } from "@/lib/sheets/tournament-houses";

const DrawSchema = z.object({ numHouses: z.number().int().positive() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { numHouses } = DrawSchema.parse(await req.json());
    await runHouseDraw(id, numHouses);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { moveParticipantToHouse } from "@/lib/sheets/tournament-houses";

const MoveSchema = z.object({ houseId: z.string().min(1) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, participantId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { houseId } = MoveSchema.parse(await req.json());
    await moveParticipantToHouse(id, participantId, houseId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write `src/app/api/tournaments/[id]/houses/matches/[matchId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { enterHouseMatchResult } from "@/lib/sheets/tournament-houses";

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
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { framesA, framesB } = ResultSchema.parse(await req.json());
    await enterHouseMatchResult(id, matchId, framesA, framesB);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/tournaments/[id]/houses/route.ts" "src/app/api/tournaments/[id]/houses/draw/route.ts" "src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts" "src/app/api/tournaments/[id]/houses/matches/[matchId]/route.ts"
git commit -m "feat(tournaments): add house draw/fetch/move/result API routes"
```

---

### Task 5: `TournamentHousesView` component

**Files:**
- Create: `src/components/tournament-houses-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type HouseMatch = {
  id: string;
  house_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
};

type HouseWithMatches = {
  id: string;
  tournament_id: string;
  label: string;
  matches: HouseMatch[];
  memberIds: string[];
};

export function TournamentHousesView({
  tournamentId,
  participants,
  handicapPointsPerRatingGap,
  canEdit,
}: {
  tournamentId: string;
  participants: Participant[];
  handicapPointsPerRatingGap: number;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [numHouses, setNumHouses] = useState("2");

  const { data, isLoading } = useQuery({
    queryKey: ["tournament-houses", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { houses: HouseWithMatches[]; hasAnyResult: boolean };
    },
  });

  const drawMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/draw`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numHouses: Number(numHouses) }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("ההגרלה בוצעה");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהגרלה"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] }),
    onError: () => toast.error("שגיאה בשמירת התוצאה"),
  });

  const moveMut = useMutation({
    mutationFn: async ({ participantId, houseId }: { participantId: string; houseId: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("השחקן הועבר");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהעברה"),
  });

  function handleDraw() {
    if (data?.hasAnyResult) {
      if (!window.confirm("כבר יש תוצאות בבתים הקיימים — הגרלה מחדש תמחק אותם. להמשיך?")) return;
    }
    drawMut.mutate();
  }

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  const houses = data?.houses ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {houses.length === 0 ? "הגרלת בתים" : "הגרלה מחדש"}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">מספר בתים</Label>
              <Input type="number" min={1} value={numHouses} onChange={(e) => setNumHouses(e.target.value)} />
            </div>
            <Button onClick={handleDraw} disabled={drawMut.isPending || !Number(numHouses)}>
              <Shuffle size={14} className="ml-1.5" />
              {drawMut.isPending ? "מגריל..." : houses.length === 0 ? "בצע הגרלה" : "הגרל מחדש"}
            </Button>
          </div>
        </div>
      )}

      {houses.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין לא בוצעה הגרלה
        </div>
      ) : (
        houses.map((house) => {
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
                      <th className="text-center px-2 py-1.5 font-medium">פרשים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
                        <td className="px-4 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          {participantName(row.participantId)}
                          {canEdit && (
                            <Select
                              value={house.id}
                              onValueChange={(v) => v && moveMut.mutate({ participantId: row.participantId, houseId: v })}
                            >
                              <SelectTrigger className="h-6 w-24 text-[10px] mr-2 inline-flex">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {houses.map((h) => (
                                  <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="text-center px-2 py-1.5">{row.wins}</td>
                        <td className="text-center px-2 py-1.5">{row.framesWon}-{row.framesLost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3 border-t border-border/40">
                {house.matches.map((m) => {
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
                    <HouseMatchRow
                      key={m.id}
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
            </div>
          );
        })
      )}
    </div>
  );
}

function HouseMatchRow({
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
  match: HouseMatch;
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
            <Input
              type="number"
              min={0}
              value={framesA}
              onChange={(e) => setFramesA(e.target.value)}
              className="h-7 w-14 text-center px-1"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              value={framesB}
              onChange={(e) => setFramesB(e.target.value)}
              className="h-7 w-14 text-center px-1"
            />
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
      {handicap && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tournament-houses-view.tsx
git commit -m "feat(tournaments): add house draw/standings/result-entry UI"
```

---

### Task 6: Wire into `TournamentDetailView`

**Files:**
- Modify: `src/components/tournament-detail-view.tsx`

- [ ] **Step 1: Add the import**

Change:
```ts
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";
```
to:
```ts
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";
import { TournamentHousesView } from "@/components/tournament-houses-view";
```

- [ ] **Step 2: Render the houses section after the participants card**

Change (the closing of the participants `<div>` block and the wrapper's closing tags):
```tsx
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```
to:
```tsx
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {participants.length > 0 && (
          <TournamentHousesView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
```

(This matches the very end of the file — find the exact closing sequence in
the actual current file, since it must line up with the participants
`.map()`'s closing braces exactly as they exist after Phase 1; if the
literal text differs slightly, locate the same logical point — right after
the participants card's closing `</div>` and before the outer content
wrapper's closing `</div></div>` — and insert the new block there.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-detail-view.tsx
git commit -m "feat(tournaments): show the house stage in the tournament detail view"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests pass, PLUS the new `tournament-logic.test.ts`
suite (should add ~13 new passing tests to the total count).

- [ ] **Step 3: Remind the user about the manual migration**

State explicitly that Task 1's migration must be run in the Supabase SQL
Editor before this phase's features work, and wait for confirmation before
asking them to test.

- [ ] **Step 4: Manual end-to-end verification**

Once the migration is applied:

1. On a tournament with several participants, as admin or the manager, set
   a number of houses and click "בצע הגרלה" — confirm houses appear with
   participants split roughly evenly (remainder in the first houses),
   round-robin matches listed under each house, and a standings table
   showing all zeros.
2. Enter a result for one match — confirm the standings table updates
   immediately (wins/frames), and separately confirm (e.g. by reopening the
   participants list above) that both players' ratings changed.
3. Confirm a handicap line appears under an unplayed pairing whenever the
   two players' ratings differ, phrased "X נותן/ת ל-Y N נקודות", and that
   it disappears (or never appears) when ratings are equal.
4. Click "הגרל מחדש" with zero results anywhere yet — confirm it re-shuffles
   immediately with no confirmation prompt. Enter at least one result, then
   click "הגרל מחדש" again — confirm a browser confirm dialog appears this
   time, and that declining it leaves the houses untouched.
5. Move a participant to a different house via the small select next to
   their name — confirm their old house's matches involving them are gone
   and new matches against their new house's members appear.
6. As a non-manager coach, open the same tournament — confirm the houses,
   standings, and match results are all visible, but there's no draw
   button, no move-house select, and no result-entry inputs (played
   matches show a plain "X - Y" score instead).

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check, confirm the migration reminder was
acknowledged, and restate that knockout brackets, public pages, the players
list, and the student personal area are still separate, upcoming phases.

---

## Plan Self-Review Notes

- **Spec coverage:** "Rating System (ELO)" (K=32, symmetric update, no
  retroactive recalculation, admin manual override is explicitly NOT built
  here — that's a `/admin/players` page feature from a later phase, not
  needed for the house stage to function), "Handicap Display" (computed
  fresh per pairing, phrased per spec's exact template), "Tournament Draw"
  (house count → auto-sized houses with remainder in first houses,
  Fisher–Yates shuffle, manual move regenerating both sides' fixtures,
  re-draw immediate-vs-confirmed based on whether any result exists), and
  "House Stage — Results & Standings" (round-robin, tie-break order, "all
  houses" view achieved by simply listing every house in the same page
  rather than a separate screen — the spec's "all houses overview" and "per
  house" views collapse into one page here since Phase 1's tournament
  detail page is already single-page) are all covered.
- **No placeholders:** every step has complete, exact code.
- **IDOR fixed proactively, not reactively:** every mutating function in
  `tournament-houses.ts` takes `tournamentId` first and verifies the
  target row belongs to it before touching anything — applying the lesson
  from Phase 1's review-caught IDOR from the start instead of waiting for
  a reviewer to find the same class of bug again.
- **Type consistency:** `HouseWithMatches`, `HouseMatch`, `House` are
  defined once in `tournament-houses.ts` (Task 3) and the exact same shapes
  are re-declared inline in `tournament-houses-view.tsx` (Task 5), matching
  every other component in this codebase's established "re-declare the
  shape at each consumer" convention (no shared generated client). Pure
  function signatures (`computeHouseStandings`, `formatHandicapLabel`,
  etc.) defined once in Task 2 are imported (never redefined) by both the
  data module (Task 3) and the UI component (Task 5).
