# Tournaments Phase 6 — Student Personal Tournament Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/student/tournaments` page (nav item "הטורנירים שלי") shows every logged-in student/tournament-customer their own current rating, every match they've played (house and knockout), and a computed final placement per tournament — behind login, richer than the public `/p/[slug]` profile which stays unchanged.

**Architecture:** Pure read-side feature — no schema changes, no new tables. A new pure, tested placement-computation function joins `tournament-logic.ts`'s existing pure functions; a new data-layer module composes it with the already-built `fetchTournamentDetail`/`fetchTournamentHouses`/`fetchKnockoutBracket` functions; a server-component page (matching the existing `/student/history` pattern — no client-side fetching needed, this page has no interactivity) renders it.

**Tech Stack:** Next.js Server Components, Supabase, Vitest.

See `docs/superpowers/specs/2026-08-11-tournaments-design.md`, section "Personal Player Area (after login)" for the full original spec this implements.

**One deliberate wording fix from the spec's literal example:** the spec's placement algorithm writes the house-fallback format as `"מקום <place> בבית <house label>"`. House labels are already generated as `` `בית ${i+1}` `` (e.g. "בית 1") — see `src/lib/sheets/tournament-houses.ts`'s `runHouseDraw` — so following the spec text literally would produce the redundant "מקום 2 בבית בית 1". This plan instead formats it as `` `מקום ${place} ב${house.label}` `` → "מקום 2 בבית 1", which is what the spec actually intends once you know the label already contains the word "בית".

**One deliberate interpretation of an edge case the spec doesn't explicitly cover:** a player who won their most-recently-played knockout match but hasn't played their next-round match yet (still "in progress", not eliminated, not yet champion). The spec's algorithm only lists outcomes for a *lost* match at various rounds, plus the champion case (won the final). This plan shows no placement line for this in-progress state — consistent with the spec's own explicit point 3 ("if nothing decided yet, show no placement line at all").

---

### Task 1: `computeTournamentPlacement` — pure logic + tests

**Files:**
- Modify: `src/lib/sheets/tournament-logic.ts`
- Modify: `src/lib/sheets/tournament-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these imports to the top of `src/lib/sheets/tournament-logic.test.ts` (extend the existing import list, don't duplicate it):

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
} from "./tournament-logic";
```

Add this new `describe` block at the end of the file:

```ts
describe("computeTournamentPlacement", () => {
  it("returns champion placement for the winner of the final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("זכה/תה בטורניר");
  });

  it("returns runner-up placement for the loser of the final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p3", matches, null)).toBe("מקום 2");
  });

  it("returns semi-final placement for a round-1 loser in a 4-player bracket", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 1, participant_a_id: "p3", participant_b_id: "p4", frames_a: 3, frames_b: 0 },
      { round: 2, participant_a_id: "p1", participant_b_id: "p3", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p2", matches, null)).toBe("הודח/ה בחצי הגמר");
  });

  it("returns quarter-final placement for a loser two rounds before a 3-round final", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 1, frames_b: 3 },
      { round: 3, participant_a_id: "x", participant_b_id: "y", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("הודח/ה ברבע הגמר");
  });

  it("returns a generic round label for an early exit in a large bracket", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 1, frames_b: 3 },
      { round: 5, participant_a_id: "x", participant_b_id: "y", frames_a: 3, frames_b: 2 },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBe("הודח/ה בסיבוב 1");
  });

  it("returns no placement for a player who won their last-played match but hasn't played the next round yet", () => {
    const matches = [
      { round: 1, participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
      { round: 2, participant_a_id: "p1", participant_b_id: null, frames_a: null, frames_b: null },
    ];
    expect(computeTournamentPlacement("p1", matches, null)).toBeNull();
  });

  it("falls back to house standings when no knockout match has been played", () => {
    const house = {
      memberIds: ["p1", "p2", "p3"],
      matches: [
        { participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
        { participant_a_id: "p1", participant_b_id: "p3", frames_a: 2, frames_b: 3 },
        { participant_a_id: "p2", participant_b_id: "p3", frames_a: 1, frames_b: 3 },
      ],
      label: "בית 1",
    };
    // Standings by wins: p3 (2), p1 (1), p2 (0) — p1 is 2nd place.
    expect(computeTournamentPlacement("p1", [], house)).toBe("מקום 2 בבית 1");
  });

  it("returns null when nothing has been played at all", () => {
    const house = {
      memberIds: ["p1", "p2"],
      matches: [{ participant_a_id: "p1", participant_b_id: "p2", frames_a: null, frames_b: null }],
      label: "בית 1",
    };
    expect(computeTournamentPlacement("p1", [], house)).toBeNull();
  });

  it("returns null when there is no house and no knockout match at all", () => {
    expect(computeTournamentPlacement("p1", [], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run`
Expected: FAIL — `computeTournamentPlacement is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `computeTournamentPlacement`**

Add this to `src/lib/sheets/tournament-logic.ts` (after `computeHouseStandings`, which it calls):

```ts
type PlacementKnockoutMatch = {
  round: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  frames_a: number | null;
  frames_b: number | null;
};

type PlacementHouse = {
  memberIds: string[];
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[];
  label: string;
};

/**
 * Computes a player's final placement in one tournament from already-stored
 * match results — no stored "result" field, this is pure read-time derivation.
 * See docs/superpowers/specs/2026-08-11-tournaments-design.md, "Placement
 * computation", for the full algorithm this implements.
 */
export function computeTournamentPlacement(
  participantId: string,
  knockoutMatches: PlacementKnockoutMatch[],
  house: PlacementHouse | null,
): string | null {
  const playedKnockout = knockoutMatches.filter(
    (m) =>
      (m.participant_a_id === participantId || m.participant_b_id === participantId) &&
      m.frames_a !== null &&
      m.frames_b !== null,
  );

  if (playedKnockout.length > 0) {
    const totalRounds = Math.max(...knockoutMatches.map((m) => m.round));
    const last = playedKnockout.reduce((a, b) => (b.round > a.round ? b : a));
    const won =
      (last.participant_a_id === participantId && last.frames_a! > last.frames_b!) ||
      (last.participant_b_id === participantId && last.frames_b! > last.frames_a!);

    if (won && last.round === totalRounds) return "זכה/תה בטורניר";
    if (!won && last.round === totalRounds) return "מקום 2";
    if (!won && last.round === totalRounds - 1) return "הודח/ה בחצי הגמר";
    if (!won && last.round === totalRounds - 2) return "הודח/ה ברבע הגמר";
    if (!won) return `הודח/ה בסיבוב ${last.round}`;
    // Won their last-played match but haven't played the next round yet —
    // still in progress, not eliminated and not yet champion.
    return null;
  }

  if (house) {
    const anyPlayed = house.matches.some((m) => m.frames_a !== null && m.frames_b !== null);
    if (!anyPlayed) return null;
    const standings = computeHouseStandings(house.memberIds, house.matches);
    const idx = standings.findIndex((s) => s.participantId === participantId);
    return idx === -1 ? null : `מקום ${idx + 1} ב${house.label}`;
  }

  return null;
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
git commit -m "feat(tournaments): add computeTournamentPlacement pure logic + tests"
```

---

### Task 2: Data layer — `fetchStudentTournamentHistory`

**Files:**
- Create: `src/lib/sheets/student-tournaments.ts`

- [ ] **Step 1: Write the file**

```ts
import { db } from "@/lib/db/client";
import { fetchTournamentDetail } from "./tournaments";
import { fetchTournamentHouses } from "./tournament-houses";
import { fetchKnockoutBracket } from "./tournament-knockout";
import { computeTournamentPlacement } from "./tournament-logic";

export type StudentMatchEntry = {
  opponentName: string;
  framesFor: number;
  framesAgainst: number;
  won: boolean;
  stage: "house" | "knockout";
};

export type StudentTournamentEntry = {
  tournamentId: string;
  tournamentName: string;
  matches: StudentMatchEntry[];
  placement: string | null;
};

export async function fetchStudentTournamentHistory(studentId: string): Promise<StudentTournamentEntry[]> {
  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("id, tournament_id")
    .eq("student_id", studentId);
  const rows = (participantRows ?? []) as { id: string; tournament_id: string }[];

  const entries = await Promise.all(rows.map((row) => buildEntry(row.tournament_id, row.id)));
  return entries.filter((e): e is StudentTournamentEntry => e !== null);
}

async function buildEntry(tournamentId: string, participantId: string): Promise<StudentTournamentEntry | null> {
  const detail = await fetchTournamentDetail(tournamentId);
  if (!detail) return null;

  const participantById = new Map(detail.participants.map((p) => [p.id, p]));
  function opponentName(otherId: string | null): string {
    if (!otherId) return "?";
    const p = participantById.get(otherId);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") || "?" : "?";
  }

  const [houses, knockoutMatches] = await Promise.all([
    fetchTournamentHouses(tournamentId),
    fetchKnockoutBracket(tournamentId),
  ]);

  const matches: StudentMatchEntry[] = [];
  const myHouse = houses.find((h) => h.memberIds.includes(participantId)) ?? null;

  for (const house of houses) {
    for (const m of house.matches) {
      if (m.frames_a === null || m.frames_b === null) continue;
      if (m.participant_a_id === participantId) {
        matches.push({
          opponentName: opponentName(m.participant_b_id),
          framesFor: m.frames_a,
          framesAgainst: m.frames_b,
          won: m.frames_a > m.frames_b,
          stage: "house",
        });
      } else if (m.participant_b_id === participantId) {
        matches.push({
          opponentName: opponentName(m.participant_a_id),
          framesFor: m.frames_b,
          framesAgainst: m.frames_a,
          won: m.frames_b > m.frames_a,
          stage: "house",
        });
      }
    }
  }

  for (const m of knockoutMatches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    if (m.participant_a_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_b_id),
        framesFor: m.frames_a,
        framesAgainst: m.frames_b,
        won: m.frames_a > m.frames_b,
        stage: "knockout",
      });
    } else if (m.participant_b_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_a_id),
        framesFor: m.frames_b,
        framesAgainst: m.frames_a,
        won: m.frames_b > m.frames_a,
        stage: "knockout",
      });
    }
  }

  const placement = computeTournamentPlacement(
    participantId,
    knockoutMatches,
    myHouse ? { memberIds: myHouse.memberIds, matches: myHouse.matches, label: myHouse.label } : null,
  );

  return { tournamentId, tournamentName: detail.tournament.name, matches, placement };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `fetchTournamentDetail`'s participant objects have a `student: {first_name, last_name, ...}` shape — confirm `opponentName` compiles against that exact shape (it does; no changes needed to `tournaments.ts`).

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass (no test file needed for this task — it's a thin composition of already-tested/already-built functions, same as `fetchContactRequests`/`fetchPlayers` have no dedicated tests in this codebase).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/student-tournaments.ts
git commit -m "feat(tournaments): add fetchStudentTournamentHistory data layer"
```

---

### Task 3: `/student/tournaments` page + nav item

**Files:**
- Create: `src/app/(student)/student/tournaments/page.tsx`
- Modify: `src/components/nav-items.ts`

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchStudentTournamentHistory } from "@/lib/sheets/student-tournaments";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StudentTournamentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const entries = await fetchStudentTournamentHistory(student.id);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">הטורנירים שלי</h1>
      <p className="text-muted-foreground mb-1">דירוג נוכחי</p>
      <p className="text-3xl font-bold mb-6">{student.rating}</p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בטורניר</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <Card key={entry.tournamentId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{entry.tournamentName}</p>
                  {entry.placement && <Badge>{entry.placement}</Badge>}
                </div>
                {entry.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">טרם שוחקו משחקים</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {entry.matches.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">נגד {m.opponentName}</span>
                        <span className={m.won ? "text-primary font-medium" : "text-muted-foreground"}>
                          {m.framesFor}-{m.framesAgainst} {m.won ? "ניצחון" : "הפסד"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `src/components/nav-items.ts`, in `STUDENT_NAV`, add a new entry right after the `{ href: "/student", ... }` line:

```ts
export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "האימונים שלי", icon: "Calendar" },
  { href: "/student/tournaments", label: "הטורנירים שלי", icon: "Trophy" },
  { href: "/student/goal", label: "המטרה שלי", icon: "Target" },
  { href: "/student/history", label: "היסטוריה", icon: "History" },
  { href: "/student/contact", label: "פנייה לאדמין", icon: "MessageSquare" },
  { href: "/student/profile", label: "פרופיל", icon: "User" },
];
```

(Only the `tournaments` line is new — every other line stays exactly as-is.) `Trophy` is already imported and registered in `src/components/app-shell.tsx`'s `ICON_MAP` (used by the existing coach/admin tournaments nav items) — no icon-registration change needed for this task.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(student)/student/tournaments/page.tsx" src/components/nav-items.ts
git commit -m "feat(tournaments): add /student/tournaments page and nav entry"
```

---

### Task 4: Final verification

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
