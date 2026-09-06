# Tournaments Phase 3: Knockout Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the tournament manager (or admin) build a single-elimination knockout bracket (4/8/16/32 slots) over the tournament's participants, manually place any participant into any round-1 slot (not restricted to house winners), finalize byes for unfilled slots, enter match results (which update ELO the same way house matches do and auto-advance the winner into the next round), and view the full bracket tree with computed handicaps. Public pages, the players list, and the student personal area (which needs this data for placement computation) remain out of scope — later phases.

**Architecture:** One new table, `tournament_knockout_matches`, self-referencing via `next_match_id` to link each match to where its winner advances. A handful of new pure functions in the existing `src/lib/sheets/tournament-logic.ts` (bracket-size validation, round count, round labels, winner-from-scores) are unit-tested exactly like Phase 2's house-stage logic. A new `src/lib/sheets/tournament-knockout.ts` data module builds the bracket back-to-front (final first, so every `next_match_id` references an already-created row), and every mutation is scoped to `tournamentId` from the start — the same IDOR-prevention and data-loss-guard patterns already established and proven in `tournament-houses.ts`.

**Tech Stack:** TypeScript, Next.js 16, Supabase, Zod, TanStack Query, React 19, Tailwind CSS v4, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-tournaments-design.md` — "Knockout Stage" and "Handicap (\"פור\") Display" sections. Builds on Phase 1 (foundation) and Phase 2 (house stage), both already shipped.

**Product decision made during planning (2026-09-06):** finalizing a bye (advancing the lone participant in a round-1 match with one empty slot) is an explicit manager action — a "סיים שיבוץ" (finish assignment) button — not automatic the moment a slot is filled. This lets the manager place participants one at a time without a premature auto-advance firing on a slot that's about to get a second participant a moment later.

**Testing note:** Same convention as every prior phase — only the new pure functions in `tournament-logic.ts` get unit tests. The data module, API routes, and UI remain covered by `npx tsc --noEmit` and manual verification, not automated tests. The migration is applied manually by the user via the Supabase SQL Editor.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260906_tournament_knockout.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE tournament_knockout_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  slot INT NOT NULL,
  participant_a_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  participant_b_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  frames_a INT,
  frames_b INT,
  next_match_id UUID REFERENCES tournament_knockout_matches(id) ON DELETE SET NULL
);

ALTER TABLE tournament_knockout_matches ENABLE ROW LEVEL SECURITY;
```

`participant_a_id`/`participant_b_id` use `ON DELETE SET NULL` (not `CASCADE`) —
removing a participant from the tournament shouldn't delete a knockout match
that already has a recorded result for the *other* side; it should just
clear the removed side, matching how `tournament_participants.house_id` was
already handled in Phase 2. `next_match_id` self-references with `ON DELETE
SET NULL` for the same reason: rebuilding the bracket deletes rows in a way
that must never leave a dangling FK.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260906_tournament_knockout.sql
git commit -m "feat(tournaments): add knockout stage schema migration"
```

- [ ] **Step 3: Note for the user**

Flag clearly in your final report that the user must run this migration
manually in the Supabase SQL Editor before this phase's features work.

---

### Task 2: Pure knockout logic + tests

**Files:**
- Modify: `src/lib/sheets/tournament-logic.ts`
- Modify: `src/lib/sheets/tournament-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `src/lib/sheets/tournament-logic.test.ts` (keep every
existing `describe` block above untouched):

```ts
describe("isValidBracketSize", () => {
  it("accepts the four supported sizes", () => {
    expect(isValidBracketSize(4)).toBe(true);
    expect(isValidBracketSize(8)).toBe(true);
    expect(isValidBracketSize(16)).toBe(true);
    expect(isValidBracketSize(32)).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidBracketSize(2)).toBe(false);
    expect(isValidBracketSize(6)).toBe(false);
    expect(isValidBracketSize(64)).toBe(false);
    expect(isValidBracketSize(0)).toBe(false);
  });
});

describe("knockoutRoundCount", () => {
  it("computes log2 of the bracket size", () => {
    expect(knockoutRoundCount(4)).toBe(2);
    expect(knockoutRoundCount(8)).toBe(3);
    expect(knockoutRoundCount(16)).toBe(4);
    expect(knockoutRoundCount(32)).toBe(5);
  });
});

describe("knockoutRoundLabel", () => {
  it("names the final and semi-final specially", () => {
    expect(knockoutRoundLabel(3, 3)).toBe("גמר");
    expect(knockoutRoundLabel(2, 3)).toBe("חצי גמר");
  });
  it("names the quarter-final specially when there are enough rounds", () => {
    expect(knockoutRoundLabel(2, 4)).toBe("רבע גמר");
  });
  it("falls back to a numbered round label for earlier rounds", () => {
    expect(knockoutRoundLabel(1, 4)).toBe("סיבוב 1");
    expect(knockoutRoundLabel(1, 3)).toBe("סיבוב 1");
  });
});

describe("knockoutMatchWinner", () => {
  it("returns 'a' when A scored more frames", () => {
    expect(knockoutMatchWinner(3, 1)).toBe("a");
  });
  it("returns 'b' when B scored more frames", () => {
    expect(knockoutMatchWinner(1, 3)).toBe("b");
  });
  it("returns null when either score is missing", () => {
    expect(knockoutMatchWinner(null, 3)).toBeNull();
    expect(knockoutMatchWinner(3, null)).toBeNull();
    expect(knockoutMatchWinner(null, null)).toBeNull();
  });
  it("returns null for a tie", () => {
    expect(knockoutMatchWinner(2, 2)).toBeNull();
  });
});
```

And add the corresponding names to the existing `import` at the top of the
test file — change:

```ts
import {
  shuffle,
  assignToHouses,
  generateRoundRobinPairs,
  computeHouseStandings,
  computeEloUpdate,
  computeHandicapPoints,
  formatHandicapLabel,
} from "./tournament-logic";
```

to:

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
} from "./tournament-logic";
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/lib/sheets/tournament-logic.test.ts`
Expected: FAIL — the four new functions don't exist yet in `tournament-logic.ts`.

- [ ] **Step 3: Write the implementation**

Add to the end of `src/lib/sheets/tournament-logic.ts` (keep every existing
function above untouched):

```ts
const VALID_BRACKET_SIZES = [4, 8, 16, 32];

export function isValidBracketSize(size: number): boolean {
  return VALID_BRACKET_SIZES.includes(size);
}

export function knockoutRoundCount(bracketSize: number): number {
  return Math.log2(bracketSize);
}

// Names the last few rounds the way players actually talk about them; earlier
// rounds fall back to a plain number. Matches the exact same naming already
// used in the spec's placement-computation section ("הודח/ה בחצי הגמר" etc.).
export function knockoutRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "גמר";
  if (fromEnd === 1) return "חצי גמר";
  if (fromEnd === 2) return "רבע גמר";
  return `סיבוב ${round}`;
}

export function knockoutMatchWinner(
  framesA: number | null,
  framesB: number | null,
): "a" | "b" | null {
  if (framesA === null || framesB === null) return null;
  if (framesA === framesB) return null;
  return framesA > framesB ? "a" : "b";
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run src/lib/sheets/tournament-logic.test.ts`
Expected: PASS, all tests green (14 existing + 12 new = 26).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets/tournament-logic.ts src/lib/sheets/tournament-logic.test.ts
git commit -m "feat(tournaments): add pure knockout bracket logic with tests"
```

---

### Task 3: `tournament-knockout.ts` data module

**Files:**
- Create: `src/lib/sheets/tournament-knockout.ts`

- [ ] **Step 1: Write the data module**

```ts
import { db } from "@/lib/db/client";
import { isValidBracketSize, knockoutRoundCount, knockoutMatchWinner, computeEloUpdate } from "./tournament-logic";

export type KnockoutMatch = {
  id: string;
  tournament_id: string;
  round: number;
  slot: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
  next_match_id: string | null;
};

export async function fetchKnockoutBracket(tournamentId: string): Promise<KnockoutMatch[]> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("round")
    .order("slot");
  return (data ?? []) as KnockoutMatch[];
}

export async function hasAnyKnockoutResult(tournamentId: string): Promise<boolean> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .not("frames_a", "is", null)
    .limit(1);
  return (data ?? []).length > 0;
}

// Builds the whole bracket empty (no participants assigned yet) — the
// manager fills round-1 slots afterward via assignParticipantToSlot. Safe
// to call again: it deletes the tournament's existing bracket first, so
// this doubles as "rebuild the bracket".
//
// Built from the final backwards (round = totalRounds down to 1) so every
// match's next_match_id can reference an already-created row — there's no
// way to insert a self-referencing tree in one shot with DB-generated ids.
export async function createKnockoutBracket(tournamentId: string, bracketSize: number): Promise<void> {
  if (!isValidBracketSize(bracketSize)) {
    throw new Error("bracket size must be 4, 8, 16, or 32");
  }

  const { error: deleteError } = await db
    .from("tournament_knockout_matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (deleteError) throw new Error(deleteError.message);

  const totalRounds = knockoutRoundCount(bracketSize);
  let nextRoundSlotToId: Record<number, string> = {};

  for (let round = totalRounds; round >= 1; round--) {
    const numMatches = bracketSize / 2 ** round;
    const thisRoundSlotToId: Record<number, string> = {};
    for (let slot = 0; slot < numMatches; slot++) {
      const nextMatchId = round === totalRounds ? null : (nextRoundSlotToId[Math.floor(slot / 2)] ?? null);
      const { data: row, error } = await db
        .from("tournament_knockout_matches")
        .insert({ tournament_id: tournamentId, round, slot, next_match_id: nextMatchId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      thisRoundSlotToId[slot] = row.id as string;
    }
    nextRoundSlotToId = thisRoundSlotToId;
  }
}

// Round-1 only, and only before that match has a recorded result — the
// manager is free to change their mind about who's in a slot until the
// match is actually played.
export async function assignParticipantToSlot(
  tournamentId: string,
  matchId: string,
  side: "a" | "b",
  participantId: string | null,
): Promise<void> {
  const { data: match } = await db
    .from("tournament_knockout_matches")
    .select("id, tournament_id, round, frames_a, frames_b")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.tournament_id !== tournamentId) throw new Error("match not found");
  if (match.round !== 1) throw new Error("participants can only be manually assigned in round 1");
  if (match.frames_a !== null || match.frames_b !== null) {
    throw new Error("cannot reassign a match that already has a result");
  }

  if (participantId) {
    const { data: participant } = await db
      .from("tournament_participants")
      .select("id, tournament_id")
      .eq("id", participantId)
      .maybeSingle();
    if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");
  }

  const column = side === "a" ? "participant_a_id" : "participant_b_id";
  const { error } = await db
    .from("tournament_knockout_matches")
    .update({ [column]: participantId })
    .eq("id", matchId);
  if (error) throw new Error(error.message);
}

// The explicit "סיים שיבוץ" action: scans every round-1 match and, for any
// one that has exactly one side filled and no result yet, advances that
// lone participant into their next match's slot. Deliberately NOT automatic
// on every assignment — the manager places participants one at a time, and
// firing this on every single assignment would prematurely advance someone
// whose opponent's slot is about to be filled a moment later. Safe to call
// more than once: matches that already have both sides filled, or already
// have a result, are simply skipped on a re-run.
export async function finalizeByes(tournamentId: string): Promise<void> {
  const { data } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("round", 1);
  const matches = (data ?? []) as KnockoutMatch[];

  for (const m of matches) {
    const hasA = m.participant_a_id !== null;
    const hasB = m.participant_b_id !== null;
    const unplayed = m.frames_a === null && m.frames_b === null;
    if (hasA !== hasB && unplayed && m.next_match_id) {
      const advancingId = hasA ? m.participant_a_id : m.participant_b_id;
      const nextSide = m.slot % 2 === 0 ? "participant_a_id" : "participant_b_id";
      const { error } = await db
        .from("tournament_knockout_matches")
        .update({ [nextSide]: advancingId })
        .eq("id", m.next_match_id);
      if (error) throw new Error(error.message);
    }
  }
}

export async function enterKnockoutMatchResult(
  tournamentId: string,
  matchId: string,
  framesA: number,
  framesB: number,
): Promise<void> {
  const { data: match } = await db
    .from("tournament_knockout_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.tournament_id !== tournamentId) throw new Error("match not found");
  if (!match.participant_a_id || !match.participant_b_id) {
    throw new Error("both participants must be set before entering a result");
  }

  const { error: updateError } = await db
    .from("tournament_knockout_matches")
    .update({ frames_a: framesA, frames_b: framesB })
    .eq("id", matchId);
  if (updateError) throw new Error(updateError.message);

  // The route layer's zod schema already rejects a tie, so this is never
  // null in practice — reused here (rather than re-deriving "who won" a
  // second time) purely to avoid two independent "framesA > framesB"
  // comparisons drifting apart if this logic is ever touched again.
  const winnerSide = knockoutMatchWinner(framesA, framesB);
  const aWon = winnerSide === "a";

  // ELO update — same forward-only convention as house matches.
  const { data: participants } = await db
    .from("tournament_participants")
    .select("id, student_id")
    .in("id", [match.participant_a_id, match.participant_b_id]);
  const pa = participants?.find((p) => p.id === match.participant_a_id);
  const pb = participants?.find((p) => p.id === match.participant_b_id);
  if (pa && pb) {
    const { data: students } = await db
      .from("students")
      .select("id, rating")
      .in("id", [pa.student_id, pb.student_id]);
    const sa = students?.find((s) => s.id === pa.student_id);
    const sb = students?.find((s) => s.id === pb.student_id);
    if (sa && sb) {
      const { newRatingA, newRatingB } = computeEloUpdate(sa.rating as number, sb.rating as number, aWon);
      const { error: ratingAError } = await db.from("students").update({ rating: newRatingA }).eq("id", sa.id);
      if (ratingAError) throw new Error(ratingAError.message);
      const { error: ratingBError } = await db.from("students").update({ rating: newRatingB }).eq("id", sb.id);
      if (ratingBError) throw new Error(ratingBError.message);
    }
  }

  // Auto-advance the winner into the next round's slot — no manual double
  // entry. slot % 2 determines which side of the next match this feeds
  // into (0-indexed slots pair up: 0&1 -> next slot 0, 2&3 -> next slot 1,
  // and within each pair the even slot always lands on side "a").
  if (match.next_match_id) {
    const winnerId = aWon ? match.participant_a_id : match.participant_b_id;
    const nextSide = match.slot % 2 === 0 ? "participant_a_id" : "participant_b_id";
    const { error: advanceError } = await db
      .from("tournament_knockout_matches")
      .update({ [nextSide]: winnerId })
      .eq("id", match.next_match_id);
    if (advanceError) throw new Error(advanceError.message);
  }
}
```

Every mutation here takes `tournamentId` first and verifies ownership before
acting — the same pattern already established in `tournament-houses.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournament-knockout.ts
git commit -m "feat(tournaments): add knockout bracket data module"
```

---

### Task 4: API routes — knockout

**Files:**
- Create: `src/app/api/tournaments/[id]/knockout/route.ts`
- Create: `src/app/api/tournaments/[id]/knockout/finalize-byes/route.ts`
- Create: `src/app/api/tournaments/[id]/knockout/matches/[matchId]/assign/route.ts`
- Create: `src/app/api/tournaments/[id]/knockout/matches/[matchId]/result/route.ts`

- [ ] **Step 1: Write `src/app/api/tournaments/[id]/knockout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { fetchKnockoutBracket, hasAnyKnockoutResult, createKnockoutBracket } from "@/lib/sheets/tournament-knockout";

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
    const [matches, hasAnyResult] = await Promise.all([fetchKnockoutBracket(id), hasAnyKnockoutResult(id)]);
    return NextResponse.json({ matches, hasAnyResult });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({ bracketSize: z.number().int().positive() });

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
    const { bracketSize } = CreateSchema.parse(await req.json());
    await createKnockoutBracket(id, bracketSize);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/tournaments/[id]/knockout/finalize-byes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { finalizeByes } from "@/lib/sheets/tournament-knockout";

export async function POST(
  _req: Request,
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
    await finalizeByes(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `src/app/api/tournaments/[id]/knockout/matches/[matchId]/assign/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { assignParticipantToSlot } from "@/lib/sheets/tournament-knockout";

const AssignSchema = z.object({
  side: z.enum(["a", "b"]),
  participantId: z.string().min(1).nullable(),
});

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
    const { side, participantId } = AssignSchema.parse(await req.json());
    await assignParticipantToSlot(id, matchId, side, participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write `src/app/api/tournaments/[id]/knockout/matches/[matchId]/result/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { enterKnockoutMatchResult } from "@/lib/sheets/tournament-knockout";

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
    await enterKnockoutMatchResult(id, matchId, framesA, framesB);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

Note these write routes already surface domain error messages as 400s from
the start (`e instanceof Error` before the generic 500 fallback) — Phase 2
needed a follow-up fix commit to add this after review; it's built in here
from the beginning instead.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/tournaments/[id]/knockout/route.ts" "src/app/api/tournaments/[id]/knockout/finalize-byes/route.ts" "src/app/api/tournaments/[id]/knockout/matches/[matchId]/assign/route.ts" "src/app/api/tournaments/[id]/knockout/matches/[matchId]/result/route.ts"
git commit -m "feat(tournaments): add knockout bracket API routes"
```

---

### Task 5: `TournamentKnockoutView` component

**Files:**
- Create: `src/components/tournament-knockout-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Swords, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { knockoutRoundCount, knockoutRoundLabel, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  student: { first_name: string; last_name: string; rating: number };
};

type KnockoutMatch = {
  id: string;
  round: number;
  slot: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
  next_match_id: string | null;
};

const BRACKET_SIZES = [4, 8, 16, 32];

export function TournamentKnockoutView({
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
  const [bracketSize, setBracketSize] = useState("8");

  const { data, isLoading } = useQuery({
    queryKey: ["tournament-knockout", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { matches: KnockoutMatch[]; hasAnyResult: boolean };
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bracketSize: Number(bracketSize) }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => {
      toast.success("הבראקט נוצר");
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה ביצירת הבראקט"),
  });

  const assignMut = useMutation({
    mutationFn: async ({ matchId, side, participantId }: { matchId: string; side: "a" | "b"; participantId: string | null }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/matches/${matchId}/assign`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side, participantId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשיבוץ"),
  });

  const finalizeByesMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/finalize-byes`, { method: "POST" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("השיבוץ הסתיים");
      qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] });
    },
    onError: () => toast.error("שגיאה בסיום השיבוץ"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/knockout/matches/${matchId}/result`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "failed");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament-knockout", tournamentId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת התוצאה"),
  });

  function handleCreate() {
    if (data?.hasAnyResult) {
      if (!window.confirm("כבר יש תוצאות בבראקט הקיים — יצירה מחדש תמחק אותן. להמשיך?")) return;
    }
    createMut.mutate();
  }

  function participantName(id: string | null) {
    if (!id) return null;
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }

  function participantRating(id: string | null) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  const matches = data?.matches ?? [];
  const totalRounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => ({
    round,
    label: knockoutRoundLabel(round, totalRounds),
    matches: matches.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot),
  }));

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {matches.length === 0 ? "בניית בראקט נוקאאוט" : "בניית בראקט מחדש"}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={bracketSize} onValueChange={(v) => v && setBracketSize(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRACKET_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s} משבצות</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              <Swords size={14} className="ml-1.5" />
              {createMut.isPending ? "יוצר..." : matches.length === 0 ? "צור בראקט" : "צור מחדש"}
            </Button>
          </div>
          {matches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => finalizeByesMut.mutate()}
              disabled={finalizeByesMut.isPending}
            >
              <CheckCheck size={14} className="ml-1.5" />
              {finalizeByesMut.isPending ? "מסיים..." : "סיים שיבוץ"}
            </Button>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין לא נוצר בראקט
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {rounds.map(({ round, label, matches: roundMatches }) => (
              <div key={round} className="flex flex-col gap-2 w-56 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                  {label}
                </p>
                {roundMatches.map((m) => {
                  const nameA = participantName(m.participant_a_id);
                  const nameB = participantName(m.participant_b_id);
                  const handicap =
                    nameA && nameB
                      ? formatHandicapLabel(
                          nameA,
                          participantRating(m.participant_a_id),
                          nameB,
                          participantRating(m.participant_b_id),
                          handicapPointsPerRatingGap,
                        )
                      : "";
                  return (
                    <KnockoutMatchCard
                      key={`${m.id}:${m.participant_a_id ?? ""}:${m.participant_b_id ?? ""}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                      match={m}
                      round={round}
                      nameA={nameA}
                      nameB={nameB}
                      handicap={handicap}
                      canEdit={canEdit}
                      participants={participants}
                      onAssign={(side, participantId) => assignMut.mutate({ matchId: m.id, side, participantId })}
                      onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                      saving={resultMut.isPending}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnockoutMatchCard({
  match,
  round,
  nameA,
  nameB,
  handicap,
  canEdit,
  participants,
  onAssign,
  onSave,
  saving,
}: {
  match: KnockoutMatch;
  round: number;
  nameA: string | null;
  nameB: string | null;
  handicap: string;
  canEdit: boolean;
  participants: Participant[];
  onAssign: (side: "a" | "b", participantId: string | null) => void;
  onSave: (framesA: number, framesB: number) => void;
  saving: boolean;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;
  const canAssign = canEdit && round === 1 && !played;
  const canEnterResult = canEdit && !played && !!match.participant_a_id && !!match.participant_b_id;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-2.5 flex flex-col gap-1.5">
      {(["a", "b"] as const).map((side) => {
        const name = side === "a" ? nameA : nameB;
        const participantId = side === "a" ? match.participant_a_id : match.participant_b_id;
        const score = side === "a" ? match.frames_a : match.frames_b;
        return (
          <div key={side} className="flex items-center gap-2 text-sm">
            {canAssign ? (
              <Select
                value={participantId ?? "__none__"}
                onValueChange={(v) => onAssign(side, !v || v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="בחר משתתף..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ריק —</SelectItem>
                  {participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex-1 truncate">{name ?? "TBD"}</span>
            )}
            {played && <span className="font-medium tabular-nums">{score}</span>}
          </div>
        );
      })}

      {canEnterResult && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40 mt-0.5">
          <Input
            type="number"
            min={0}
            value={framesA}
            onChange={(e) => setFramesA(e.target.value)}
            className="h-7 w-12 text-center px-1 text-xs"
          />
          <span className="text-muted-foreground text-xs">-</span>
          <Input
            type="number"
            min={0}
            value={framesB}
            onChange={(e) => setFramesB(e.target.value)}
            className="h-7 w-12 text-center px-1 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            disabled={saving || framesA === "" || framesB === ""}
            onClick={() => onSave(Number(framesA), Number(framesB))}
          >
            שמור
          </Button>
        </div>
      )}

      {handicap && !played && <p className="text-[10px] text-muted-foreground pt-0.5">{handicap}</p>}
    </div>
  );
}
```

Note the `KnockoutMatchCard` key includes `participant_a_id`, `participant_b_id`,
`frames_a`, and `frames_b` — not just `m.id` — so it remounts (and its local
frame-input state resets) whenever the underlying match data actually
changes, whether from a saved result, a manual re-assignment, or an
auto-advance/bye writing a new participant into a previously-empty slot.
This applies, from the start, the exact lesson Phase 2's review found the
hard way for `HouseMatchRow` (see `src/components/tournament-houses-view.tsx`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tournament-knockout-view.tsx
git commit -m "feat(tournaments): add knockout bracket build/assign/result UI"
```

---

### Task 6: Wire into `TournamentDetailView`

**Files:**
- Modify: `src/components/tournament-detail-view.tsx`

- [ ] **Step 1: Add the import**

Change:
```ts
import { TournamentHousesView } from "@/components/tournament-houses-view";
```
to:
```ts
import { TournamentHousesView } from "@/components/tournament-houses-view";
import { TournamentKnockoutView } from "@/components/tournament-knockout-view";
```

- [ ] **Step 2: Render the knockout section after the houses section**

Read the current file first to find the exact block added by Phase 2 (a
`{participants.length > 0 && (<TournamentHousesView ... />)}` block, right
before the closing `</div>` of the `"px-4 md:px-6 flex flex-col gap-4"`
wrapper). Add the new block as a sibling immediately after it, still inside
that same wrapper:

Change:
```tsx
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
to:
```tsx
        {participants.length > 0 && (
          <TournamentHousesView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}

        {participants.length > 0 && (
          <TournamentKnockoutView
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

If the actual current file's ending doesn't match this literally (e.g. it
was reformatted since), don't force it — locate the same logical point
(right after the houses section, before the wrapper's closing `</div>`) and
insert the new block there instead of guessing blindly.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-detail-view.tsx
git commit -m "feat(tournaments): show the knockout stage in the tournament detail view"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests pass, plus 12 new tests added to
`tournament-logic.test.ts` in Task 2 (26 total in that file).

- [ ] **Step 3: Remind the user about the manual migration**

State explicitly that Task 1's migration must be run in the Supabase SQL
Editor before this phase's features work, and wait for confirmation before
asking them to test.

- [ ] **Step 4: Manual end-to-end verification**

Once the migration is applied:

1. On a tournament with several participants, as admin or the manager, pick
   a bracket size and click "צור בראקט" — confirm the full round structure
   appears (correct number of rounds and matches per round), every slot
   empty, later rounds all showing "TBD" vs "TBD".
2. Manually assign participants to round-1 slots via the per-slot select —
   confirm the assignment saves and the name appears immediately.
3. Leave one round-1 slot empty on purpose (one side filled, one side
   blank) and click "סיים שיבוץ" — confirm the lone participant appears in
   the correct slot of the next round, and that clicking it again is a
   harmless no-op.
4. Enter a result for a round-1 match with both sides filled — confirm the
   winner appears automatically in their next-round slot, both players'
   ratings changed, and a handicap line appears under any unplayed pairing
   where ratings differ.
5. Click "צור מחדש" with zero results anywhere yet — confirm it rebuilds
   immediately with no confirmation prompt. Enter at least one result, then
   click "צור מחדש" again — confirm a browser confirm dialog appears this
   time, and declining it leaves the bracket untouched.
6. Try to reassign a round-1 slot that already has a recorded result —
   confirm it's rejected with a clear message, not a silent failure or a
   wiped result.
7. As a non-manager coach, open the same tournament — confirm the full
   bracket, names, and scores are visible, but there's no bracket-size
   picker, no "סיים שיבוץ" button, no assignment selects, and no
   result-entry inputs.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check, confirm the migration reminder was
acknowledged, and restate that public pages, the players list, and the
student personal area are still separate, upcoming phases — and that the
student area's placement-computation feature specifically depends on this
phase's data (`tournament_knockout_matches`) being in place, which it now is.

---

## Plan Self-Review Notes

- **Spec coverage:** every numbered step of the spec's "Knockout Stage"
  section is covered — bracket size is a power of 2 (4/8/16/32, enforced by
  `isValidBracketSize`), manual placement of any participant regardless of
  house (Task 3's `assignParticipantToSlot` has no house-based restriction),
  empty slot = bye with an explicit finalize action (product decision
  captured above), results entered the same way as house matches with ELO
  update (Task 3's `enterKnockoutMatchResult` mirrors
  `enterHouseMatchResult`), automatic advancement into `next_match_id` (same
  function), and a rendered bracket tree with names/scores/TBD and computed
  handicaps (Task 5). The one spec sentence explicitly deferred is "Also
  part of the public page" — correctly out of scope per the phase
  breakdown the user approved (Phase 4).
- **No placeholders:** every step has complete, exact code.
- **Lessons from Phase 2 applied proactively, not reactively:** IDOR
  guards and ownership checks are in `tournament-knockout.ts` from the
  first draft (not added after a review finding); API routes surface
  specific domain error messages as 400s from the first draft (Phase 2
  needed a follow-up fix commit for this); `KnockoutMatchCard` is keyed on
  the full set of server-derived values that affect its local state, not
  just the row's id (Phase 2's `HouseMatchRow` needed a follow-up fix
  commit for this).
- **Type consistency:** `KnockoutMatch` is defined once in
  `tournament-knockout.ts` (Task 3) and the same shape is re-declared
  inline in `tournament-knockout-view.tsx` (Task 5), matching this
  codebase's established "re-declare the shape at each consumer"
  convention (same as Phase 2's `HouseWithMatches`/`Participant` split).
  Pure function signatures (`knockoutRoundCount`, `knockoutRoundLabel`,
  `knockoutMatchWinner`, `isValidBracketSize`) defined once in Task 2 are
  imported, never redefined, by both the data module and the UI.
