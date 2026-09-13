# Leagues Phase 3 — Student Personal Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing `/student/tournaments` page with a second section listing the leagues the logged-in student is in, each showing their district's matches (opponent, score, win/loss) and their current standing in that district.

**Architecture:** One new pure-logic function `computeLeaguePlacement` in `tournament-logic.ts` (TDD, mirrors the house-standings branch of the existing `computeTournamentPlacement`), one new data-composition module `src/lib/sheets/student-leagues.ts` (mirrors `student-tournaments.ts`), and a modification to the existing `/student/tournaments/page.tsx` to render a second section. No new page, no new nav item — same page, same nav entry, per the spec.

**Tech Stack:** Next.js 16 App Router (server component), TypeScript strict mode, Vitest, Tailwind CSS v4.

---

### Task 1: `computeLeaguePlacement`

**Files:**
- Modify: `src/lib/sheets/tournament-logic.ts`
- Modify: `src/lib/sheets/tournament-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/sheets/tournament-logic.test.ts` (add the import to the existing import block at the top, alongside `computeTournamentPlacement`, `generateLeagueRounds`):

```ts
  computeLeaguePlacement,
```

Then add this new `describe` block at the end of the file:

```ts
describe("computeLeaguePlacement", () => {
  it("returns the player's rank and district label once at least one match has a result", () => {
    const district = {
      memberIds: ["p1", "p2", "p3"],
      matches: [
        { participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 },
        { participant_a_id: "p1", participant_b_id: "p3", frames_a: 2, frames_b: 3 },
        { participant_a_id: "p2", participant_b_id: "p3", frames_a: 1, frames_b: 3 },
      ],
      label: "צפון",
    };
    // Standings by wins: p3 (2), p1 (1), p2 (0) — p1 is 2nd place.
    expect(computeLeaguePlacement("p1", district)).toBe("מקום 2 בצפון");
  });

  it("returns null when no match in the district has a result yet", () => {
    const district = {
      memberIds: ["p1", "p2"],
      matches: [{ participant_a_id: "p1", participant_b_id: "p2", frames_a: null, frames_b: null }],
      label: "צפון",
    };
    expect(computeLeaguePlacement("p1", district)).toBeNull();
  });

  it("returns null when the participant isn't a member of the district", () => {
    const district = {
      memberIds: ["p1", "p2"],
      matches: [{ participant_a_id: "p1", participant_b_id: "p2", frames_a: 3, frames_b: 1 }],
      label: "צפון",
    };
    expect(computeLeaguePlacement("p9", district)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run`
Expected: FAIL — `computeLeaguePlacement` is not exported from `./tournament-logic`.

- [ ] **Step 3: Implement `computeLeaguePlacement`**

Add to `src/lib/sheets/tournament-logic.ts`, directly after `computeTournamentPlacement` (reuses the exact same `computeHouseStandings` call and placement-string format already used there for the house-fallback branch — a league placement is simpler since there's no knockout stage to consider):

```ts
type PlacementDistrict = {
  memberIds: string[];
  matches: { participant_a_id: string; participant_b_id: string; frames_a: number | null; frames_b: number | null }[];
  label: string;
};

/**
 * Computes a player's current standing within one league district from
 * already-stored match results — no stored "placement" field, this is pure
 * read-time derivation, same philosophy as computeTournamentPlacement.
 * Simpler than the tournament version: a league has no knockout stage, so
 * a placement is always just "current position in the district table,"
 * computable as soon as at least one match in that district has a result.
 */
export function computeLeaguePlacement(participantId: string, district: PlacementDistrict): string | null {
  const anyPlayed = district.matches.some((m) => m.frames_a !== null && m.frames_b !== null);
  if (!anyPlayed) return null;
  const standings = computeHouseStandings(district.memberIds, district.matches);
  const idx = standings.findIndex((s) => s.participantId === participantId);
  return idx === -1 ? null : `מקום ${idx + 1} ב${district.label}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/tournament-logic.ts src/lib/sheets/tournament-logic.test.ts
git commit -m "feat(leagues): add computeLeaguePlacement with tests"
```

---

### Task 2: Student league history data layer

**Files:**
- Create: `src/lib/sheets/student-leagues.ts`

- [ ] **Step 1: Write `fetchStudentLeagueHistory`**

```ts
import { db } from "@/lib/db/client";
import { fetchLeagueDetail } from "./leagues";
import { fetchLeagueDistricts } from "./league-districts";
import { computeLeaguePlacement } from "./tournament-logic";

export type StudentLeagueMatchEntry = {
  opponentName: string;
  framesFor: number;
  framesAgainst: number;
  won: boolean;
};

export type StudentLeagueEntry = {
  leagueId: string;
  leagueName: string;
  districtLabel: string | null;
  matches: StudentLeagueMatchEntry[];
  placement: string | null;
};

export async function fetchStudentLeagueHistory(studentId: string): Promise<StudentLeagueEntry[]> {
  const { data: participantRows } = await db
    .from("league_participants")
    .select("id, league_id, district_id")
    .eq("student_id", studentId);
  const rows = (participantRows ?? []) as { id: string; league_id: string; district_id: string | null }[];

  const entries = await Promise.all(rows.map((row) => buildEntry(row.league_id, row.id, row.district_id)));
  return entries.filter((e): e is StudentLeagueEntry => e !== null);
}

async function buildEntry(
  leagueId: string,
  participantId: string,
  districtId: string | null,
): Promise<StudentLeagueEntry | null> {
  const detail = await fetchLeagueDetail(leagueId);
  if (!detail) return null;

  // Not yet assigned to a district — nothing to schedule or show yet, but
  // the league still shows up so the student knows they're registered.
  if (!districtId) {
    return { leagueId, leagueName: detail.league.name, districtLabel: null, matches: [], placement: null };
  }

  const districts = await fetchLeagueDistricts(leagueId);
  const myDistrict = districts.find((d) => d.id === districtId);
  if (!myDistrict) {
    return { leagueId, leagueName: detail.league.name, districtLabel: null, matches: [], placement: null };
  }

  const participantById = new Map(detail.participants.map((p) => [p.id, p]));
  function opponentName(otherId: string): string {
    const p = participantById.get(otherId);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") || "?" : "?";
  }

  const matches: StudentLeagueMatchEntry[] = [];
  for (const m of myDistrict.matches) {
    if (m.frames_a === null || m.frames_b === null) continue;
    if (m.participant_a_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_b_id),
        framesFor: m.frames_a,
        framesAgainst: m.frames_b,
        won: m.frames_a > m.frames_b,
      });
    } else if (m.participant_b_id === participantId) {
      matches.push({
        opponentName: opponentName(m.participant_a_id),
        framesFor: m.frames_b,
        framesAgainst: m.frames_a,
        won: m.frames_b > m.frames_a,
      });
    }
  }

  const placement = computeLeaguePlacement(participantId, {
    memberIds: myDistrict.memberIds,
    matches: myDistrict.matches,
    label: myDistrict.label,
  });

  return { leagueId, leagueName: detail.league.name, districtLabel: myDistrict.label, matches, placement };
}
```

No test file for this — matches the established precedent that `student-tournaments.ts` (the module this mirrors) has no dedicated test file either; it's a thin DB-composition layer, not pure logic.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/student-leagues.ts
git commit -m "feat(leagues): add student league history data layer"
```

---

### Task 3: Extend the student tournaments page with a leagues section

**Files:**
- Modify: `src/app/(student)/student/tournaments/page.tsx`

- [ ] **Step 1: Add the leagues section**

Replace the full contents of `src/app/(student)/student/tournaments/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchStudentTournamentHistory } from "@/lib/sheets/student-tournaments";
import { fetchStudentLeagueHistory } from "@/lib/sheets/student-leagues";
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

  const [entries, leagueEntries] = await Promise.all([
    fetchStudentTournamentHistory(student.id),
    fetchStudentLeagueHistory(student.id),
  ]);

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

      <h2 className="text-xl font-bold mt-10 mb-4">הליגות שלי</h2>
      {leagueEntries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בליגה</p>
      ) : (
        <div className="flex flex-col gap-4">
          {leagueEntries.map((entry) => (
            <Card key={entry.leagueId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.leagueName}</p>
                    {entry.districtLabel && <p className="text-xs text-muted-foreground">{entry.districtLabel}</p>}
                  </div>
                  {entry.placement && <Badge>{entry.placement}</Badge>}
                </div>
                {!entry.districtLabel ? (
                  <p className="text-sm text-muted-foreground">עדיין לא שובצת למחוז</p>
                ) : entry.matches.length === 0 ? (
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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(student)/student/tournaments/page.tsx"
git commit -m "feat(leagues): show student's leagues on the tournaments personal-area page"
```

---

### Task 4: Final verification and push

- [ ] **Step 1: Full-repo typecheck and test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 2: Push**

```bash
git push origin main
```
