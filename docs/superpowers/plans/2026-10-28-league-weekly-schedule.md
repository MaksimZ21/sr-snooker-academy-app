# League Weekly Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin give each league match a play date (by pasting the external AI's weekly schedule, or by hand), show that schedule on the admin and public league pages, and enter results from the schedule — per `docs/superpowers/specs/2026-10-28-league-weekly-schedule-design.md`.

**Architecture:** One nullable `scheduled_date` column on `league_matches`. A pure, client-safe module parses pasted text and resolves each line to an open match; the admin page already has every participant and match loaded, so parsing happens in the browser and only the resulting `{matchId, date}` assignments go to one new admin-only endpoint. Display reuses the existing `["league-districts", leagueId]` query.

**Tech Stack:** Next.js 16 App Router, Supabase (service-role, no RLS policies), Zod, TanStack Query, Vitest, shadcn/ui on `@base-ui/react`, date-fns.

---

## Notes for every task

- Never import `src/lib/db/client.ts` (or any module that imports it, e.g. `league-districts.ts`, `leagues.ts`) as a **value** from a `"use client"` file — it breaks `npm run build` (Next.js rejects the server-only code in the client bundle). `import type` is fine. The new parse module has no `db` import precisely so client components can use it.
- Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The project has no ESLint config; verification is `npx tsc --noEmit` and `npm run test:run` (72 tests pass before this plan).
- `students.id` is TEXT; `league_matches.id` / `league_districts.id` are UUID.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261028_league_match_scheduled_date.sql`

- [ ] **Step 1: Write the migration**

```sql
-- The day a league match is scheduled to be played (no time — players
-- arrange the hour themselves). Null = not scheduled. Set by the admin
-- from the league page, either by pasting the weekly schedule an external
-- AI produces or by hand. See
-- docs/superpowers/specs/2026-10-28-league-weekly-schedule-design.md.
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS scheduled_date date;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261028_league_match_scheduled_date.sql
git commit -m "feat(leagues): add league_matches.scheduled_date"
```

- [ ] **Step 3: Ask the user to run it** in the Supabase SQL Editor before any task that reads the column is deployed.

---

### Task 2: Pure parse module (TDD)

**Files:**
- Create: `src/lib/sheets/league-schedule-parse.ts`
- Test: `src/lib/sheets/league-schedule-parse.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  parseScheduleDate,
  resolveSchedulePaste,
  buildOpenMatchesText,
  shortDate,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "./league-schedule-parse";

const TODAY = "2026-10-28";

const people: ScheduleParticipant[] = [
  { id: "p1", name: "דני כהן" },
  { id: "p2", name: "יוסי לוי" },
  { id: "p3", name: "משה פרץ" },
  { id: "p4", name: "משה כץ" },
];

function match(id: string, a: string, b: string, extra: Partial<ScheduleMatch> = {}): ScheduleMatch {
  return {
    id,
    district_id: "d1",
    participant_a_id: a,
    participant_b_id: b,
    frames_a: null,
    scheduled_date: null,
    ...extra,
  };
}

describe("parseScheduleDate", () => {
  it("parses D.M and D/M to the nearest year", () => {
    expect(parseScheduleDate("2.11", TODAY)).toBe("2026-11-02");
    expect(parseScheduleDate("2/11", TODAY)).toBe("2026-11-02");
  });

  it("finds the date after a day name", () => {
    expect(parseScheduleDate("יום ראשון 2.11 ", TODAY)).toBe("2026-11-02");
  });

  it("rolls over the year boundary", () => {
    expect(parseScheduleDate("15.1", "2026-12-20")).toBe("2027-01-15");
    expect(parseScheduleDate("30.12", "2027-01-03")).toBe("2026-12-30");
  });

  it("accepts an explicit 2- or 4-digit year", () => {
    expect(parseScheduleDate("2.11.2026", TODAY)).toBe("2026-11-02");
    expect(parseScheduleDate("2.11.26", TODAY)).toBe("2026-11-02");
  });

  it("rejects impossible or missing dates", () => {
    expect(parseScheduleDate("31.2", TODAY)).toBeNull();
    expect(parseScheduleDate("יום ראשון", TODAY)).toBeNull();
  });
});

describe("shortDate", () => {
  it("formats an ISO date as D.M", () => {
    expect(shortDate("2026-11-02")).toBe("2.11");
  });
});

describe("resolveSchedulePaste", () => {
  it("matches a line to the open match between the two players", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res).toEqual([
      { raw: "2.11 | דני כהן - יוסי לוי", ok: true, matchId: "m1", date: "2026-11-02", districtId: "d1", movedFrom: null },
    ]);
  });

  it("accepts either player order and נגד as the separator", () => {
    const res = resolveSchedulePaste("2.11 | יוסי לוי נגד דני כהן", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: true, matchId: "m1" });
  });

  it("ignores blank lines and lines without |", () => {
    const res = resolveSchedulePaste("לוז לשבוע:\n\n2.11 | דני כהן - יוסי לוי\n", people, [match("m1", "p1", "p2")], TODAY);
    expect(res).toHaveLength(1);
  });

  it("accepts a first name that matches exactly one player", () => {
    const res = resolveSchedulePaste("2.11 | דני - יוסי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: true, matchId: "m1" });
  });

  it("rejects an ambiguous first name", () => {
    const res = resolveSchedulePaste("2.11 | משה - דני כהן", people, [match("m1", "p3", "p1")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: expect.stringContaining("לא חד-משמעי") });
  });

  it("rejects an unknown name", () => {
    const res = resolveSchedulePaste("2.11 | אבי - דני כהן", people, [match("m1", "p3", "p1")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: expect.stringContaining("לא נמצא") });
  });

  it("rejects the same player on both sides", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - דני כהן", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: false });
  });

  it("rejects a pair with no open match", () => {
    const res = resolveSchedulePaste("2.11 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2", { frames_a: 2 })], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: "אין משחק פתוח ביניהם" });
  });

  it("rejects the same match twice in one paste", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי\n3.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2")],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true });
    expect(res[1]).toMatchObject({ ok: false, error: "המשחק כבר מופיע בשורה קודמת" });
  });

  it("prefers an unscheduled match when the pair has several open ones", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2", { scheduled_date: "2026-10-27" }), match("m2", "p1", "p2")],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true, matchId: "m2", movedFrom: null });
  });

  it("moves the earliest-scheduled match when every open one is scheduled", () => {
    const res = resolveSchedulePaste(
      "2.11 | דני כהן - יוסי לוי",
      people,
      [match("m1", "p1", "p2", { scheduled_date: "2026-10-27" }), match("m2", "p1", "p2", { scheduled_date: "2026-10-20" })],
      TODAY,
    );
    expect(res[0]).toMatchObject({ ok: true, matchId: "m2", movedFrom: "2026-10-20" });
  });

  it("reports a bad date", () => {
    const res = resolveSchedulePaste("31.2 | דני כהן - יוסי לוי", people, [match("m1", "p1", "p2")], TODAY);
    expect(res[0]).toMatchObject({ ok: false, error: "תאריך לא תקין" });
  });
});

describe("buildOpenMatchesText", () => {
  it("lists only unplayed matches per district, noting scheduled ones", () => {
    const text = buildOpenMatchesText(
      "ליגת חורף",
      [
        {
          label: "צפון",
          matches: [
            match("m1", "p1", "p2"),
            match("m2", "p1", "p3", { frames_a: 2 }),
            match("m3", "p2", "p3", { scheduled_date: "2026-11-02" }),
          ],
        },
      ],
      people,
    );
    expect(text).toContain("ליגת חורף");
    expect(text).toContain("צפון:");
    expect(text).toContain("דני כהן - יוסי לוי");
    expect(text).not.toContain("דני כהן - משה פרץ");
    expect(text).toContain("יוסי לוי - משה פרץ (משובץ ל-2.11)");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sheets/league-schedule-parse.test.ts`
Expected: FAIL — cannot resolve `./league-schedule-parse`.

- [ ] **Step 3: Implement**

```ts
// Pure and client-safe (no db import): turns the weekly league schedule an
// external AI produces into match assignments, and builds the text the
// admin gives that AI. See
// docs/superpowers/specs/2026-10-28-league-weekly-schedule-design.md.

export type ScheduleParticipant = { id: string; name: string };

export type ScheduleMatch = {
  id: string;
  district_id: string;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  scheduled_date: string | null;
};

export type ScheduleLineResult =
  | { raw: string; ok: true; matchId: string; date: string; districtId: string; movedFrom: string | null }
  | { raw: string; ok: false; error: string };

export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// "2.11", "2/11", "2.11.2026", "2.11.26", anywhere in the text. With no
// year, picks whichever of last/this/next year lands closest to today, so
// a schedule pasted in late December for early January gets next year.
export function parseScheduleDate(text: string, todayIso: string): string | null {
  const m = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2})(?!\d))?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);

  if (m[3]) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null;
  }

  const todayYear = Number(todayIso.slice(0, 4));
  const todayMs = Date.UTC(todayYear, Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)));
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const year of [todayYear - 1, todayYear, todayYear + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const diff = Math.abs(Date.UTC(year, month - 1, day) - todayMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = `${year}-${pad(month)}-${pad(day)}`;
    }
  }
  return best;
}

function normalizeName(s: string): string {
  return s.replace(/["'״׳]/g, "").replace(/\s+/g, " ").trim();
}

function findParticipant(
  input: string,
  participants: ScheduleParticipant[],
): { ok: true; id: string } | { ok: false; error: string } {
  const name = normalizeName(input);
  const exact = participants.filter((p) => normalizeName(p.name) === name);
  if (exact.length === 1) return { ok: true, id: exact[0].id };
  if (exact.length > 1) return { ok: false, error: `שם לא חד-משמעי: ${name}` };

  const byFirstName = participants.filter((p) => normalizeName(p.name).split(" ")[0] === name);
  if (byFirstName.length === 1) return { ok: true, id: byFirstName[0].id };
  if (byFirstName.length > 1) return { ok: false, error: `שם לא חד-משמעי: ${name}` };

  return { ok: false, error: `שם לא נמצא: ${name}` };
}

// One result per line containing "|" (everything else — headings, blank
// lines — is ignored). Lines are resolved in order, and a match used by an
// earlier line can't be used again.
export function resolveSchedulePaste(
  text: string,
  participants: ScheduleParticipant[],
  matches: ScheduleMatch[],
  todayIso: string,
): ScheduleLineResult[] {
  const used = new Set<string>();
  const results: ScheduleLineResult[] = [];

  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    const bar = raw.indexOf("|");
    if (!raw || bar === -1) continue;

    const date = parseScheduleDate(raw.slice(0, bar), todayIso);
    if (!date) {
      results.push({ raw, ok: false, error: "תאריך לא תקין" });
      continue;
    }

    const names = raw
      .slice(bar + 1)
      .split(/\s+(?:-|–|—|נגד)\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length !== 2) {
      results.push({ raw, ok: false, error: 'צריך שני שמות מופרדים ב-" - "' });
      continue;
    }

    const a = findParticipant(names[0], participants);
    if (!a.ok) {
      results.push({ raw, ok: false, error: a.error });
      continue;
    }
    const b = findParticipant(names[1], participants);
    if (!b.ok) {
      results.push({ raw, ok: false, error: b.error });
      continue;
    }
    if (a.id === b.id) {
      results.push({ raw, ok: false, error: "אותו שחקן משני הצדדים" });
      continue;
    }

    const open = matches.filter(
      (m) =>
        m.frames_a === null &&
        ((m.participant_a_id === a.id && m.participant_b_id === b.id) ||
          (m.participant_a_id === b.id && m.participant_b_id === a.id)),
    );
    const free = open.filter((m) => !used.has(m.id));
    if (free.length === 0) {
      results.push({
        raw,
        ok: false,
        error: open.length > 0 ? "המשחק כבר מופיע בשורה קודמת" : "אין משחק פתוח ביניהם",
      });
      continue;
    }

    // A match scheduled earlier but never played gets moved to the new day.
    const pick =
      free.find((m) => !m.scheduled_date) ??
      [...free].sort((x, y) => (x.scheduled_date ?? "").localeCompare(y.scheduled_date ?? ""))[0];
    used.add(pick.id);
    results.push({
      raw,
      ok: true,
      matchId: pick.id,
      date,
      districtId: pick.district_id,
      movedFrom: pick.scheduled_date && pick.scheduled_date !== date ? pick.scheduled_date : null,
    });
  }

  return results;
}

// The block the admin copies into the AI alongside the availability poll:
// the format instruction travels with the data, so there's no separate
// prompt to keep in sync with this parser.
export function buildOpenMatchesText(
  leagueName: string,
  districts: { label: string; matches: ScheduleMatch[] }[],
  participants: ScheduleParticipant[],
): string {
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const lines = [
    `ליגה: ${leagueName}`,
    "",
    "החזר את הלוז לשבוע בפורמט הזה בלבד, שורה אחת לכל משחק:",
    "יום.חודש | שם מלא - שם מלא",
    "לדוגמה: 2.11 | דני כהן - יוסי לוי",
    "השתמש בשמות בדיוק כפי שהם כתובים למטה.",
    "",
    "משחקים שעוד לא שוחקו:",
  ];
  for (const d of districts) {
    const open = d.matches.filter((m) => m.frames_a === null);
    if (open.length === 0) continue;
    lines.push("", `${d.label}:`);
    for (const m of open) {
      const suffix = m.scheduled_date ? ` (משובץ ל-${shortDate(m.scheduled_date)})` : "";
      lines.push(`${nameOf.get(m.participant_a_id) ?? "?"} - ${nameOf.get(m.participant_b_id) ?? "?"}${suffix}`);
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/sheets/league-schedule-parse.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/league-schedule-parse.ts src/lib/sheets/league-schedule-parse.test.ts
git commit -m "feat(leagues): parse pasted weekly schedule into match assignments"
```

---

### Task 3: Server write path — type, function, API route

**Files:**
- Modify: `src/lib/sheets/league-districts.ts` (the `LeagueMatch` type, and append a function)
- Create: `src/app/api/leagues/[id]/schedule/route.ts`

- [ ] **Step 1: Add the column to the type**

In `src/lib/sheets/league-districts.ts`, `LeagueMatch` becomes:

```ts
export type LeagueMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  scheduled_date: string | null;
};
```

(`fetchLeagueDistricts` already does `select("*")`, so the column comes back with no query change. It is not sensitive, and showing it on the public page is intended — `leagues-public.ts` reuses this function.)

- [ ] **Step 2: Append the write function** to the end of `src/lib/sheets/league-districts.ts`:

```ts
// Sets (or clears, with date: null) the play date of league matches.
// Everything is validated before anything is written, so a bad id in a
// pasted batch doesn't leave half the week scheduled.
export async function scheduleLeagueMatches(
  leagueId: string,
  assignments: { matchId: string; date: string | null }[],
): Promise<void> {
  if (assignments.length === 0) return;

  const { data: districtRows } = await db.from("league_districts").select("id").eq("league_id", leagueId);
  const districtIds = new Set((districtRows ?? []).map((d) => d.id as string));

  const { data: matchRows } = await db
    .from("league_matches")
    .select("id, district_id, frames_a")
    .in("id", assignments.map((a) => a.matchId));
  const matchesById = new Map((matchRows ?? []).map((m) => [m.id as string, m]));

  for (const a of assignments) {
    const m = matchesById.get(a.matchId);
    if (!m || !districtIds.has(m.district_id as string)) throw new Error("match not found");
    if (m.frames_a !== null) throw new Error("cannot reschedule a match that was already played");
  }

  for (const a of assignments) {
    const { error } = await db.from("league_matches").update({ scheduled_date: a.date }).eq("id", a.matchId);
    if (error) throw new Error(error.message);
  }
}
```

- [ ] **Step 3: Create the route** `src/app/api/leagues/[id]/schedule/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchLeagueDetail, canManageLeagues } from "@/lib/sheets/leagues";
import { scheduleLeagueMatches } from "@/lib/sheets/league-districts";

const ScheduleSchema = z.object({
  assignments: z
    .array(
      z.object({
        matchId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      }),
    )
    .max(500),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const detail = await fetchLeagueDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!canManageLeagues(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { assignments } = ScheduleSchema.parse(await req.json());
    await scheduleLeagueMatches(id, assignments);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/league-districts.ts src/app/api/leagues/[id]/schedule/route.ts
git commit -m "feat(leagues): admin endpoint to set match play dates"
```

---

### Task 4: Paste dialog component

**Files:**
- Create: `src/components/league-schedule-paste-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { todayIsoTel, dayLabelHe } from "@/lib/date";
import {
  resolveSchedulePaste,
  shortDate,
  type ScheduleLineResult,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";

type OkLine = Extract<ScheduleLineResult, { ok: true }>;

export function LeagueSchedulePasteDialog({
  open,
  onOpenChange,
  participants,
  matches,
  districtLabels,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ScheduleParticipant[];
  matches: ScheduleMatch[];
  districtLabels: Map<string, string>;
  onSave: (assignments: { matchId: string; date: string }[]) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const results = useMemo(
    () => resolveSchedulePaste(text, participants, matches, todayIsoTel()),
    [text, participants, matches],
  );
  const okLines = results.filter((r): r is OkLine => r.ok);

  async function save() {
    try {
      await onSave(okLines.map((r) => ({ matchId: r.matchId, date: r.date })));
      setText("");
      onOpenChange(false);
    } catch {
      // The mutation's onError already showed a toast; keep the dialog open.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>הדבקת לוז</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"הדבק כאן את הלוז מה-AI, שורה לכל משחק, למשל:\n2.11 | דני כהן - יוסי לוי"}
            className="min-h-36"
          />
          {results.length > 0 && (
            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
                  {r.ok ? (
                    <Check size={16} className="text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X size={16} className="text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate">{r.raw}</p>
                    <p className={r.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                      {r.ok
                        ? `${districtLabels.get(r.districtId) ?? ""} · ${dayLabelHe(r.date)} ${shortDate(r.date)}${
                            r.movedFrom ? ` · יועבר מ-${shortDate(r.movedFrom)}` : ""
                          }`
                        : r.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={save} disabled={okLines.length === 0 || saving}>
            {saving ? "שומר..." : `שבץ ${okLines.length} משחקים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/league-schedule-paste-dialog.tsx
git commit -m "feat(leagues): paste dialog with per-line preview for the weekly schedule"
```

---

### Task 5: Schedule section on the league page

**Files:**
- Create: `src/components/league-schedule-view.tsx`
- Modify: `src/components/league-detail-view.tsx` (import + render above `<LeagueDistrictsView`)

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, ClipboardCopy, ClipboardPaste, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import {
  buildOpenMatchesText,
  shortDate,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";
import { LeagueSchedulePasteDialog } from "@/components/league-schedule-paste-dialog";

type Participant = { id: string; student: { first_name: string; last_name: string } };
type DistrictMatch = ScheduleMatch & { round: number; frames_b: number | null };
type District = { id: string; label: string; matches: DistrictMatch[] };

export function LeagueScheduleView({
  leagueId,
  leagueName,
  participants,
  canEdit,
}: {
  leagueId: string;
  leagueName: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(todayIsoTel());
  const [pasteOpen, setPasteOpen] = useState(false);
  const { startIso, endIso } = weekRangeFor(anchor);

  // Same key and URL as LeagueDistrictsView, so the two share one cache entry.
  const { data, isLoading } = useQuery({
    queryKey: ["league-districts", leagueId],
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/districts`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { districts: District[] };
    },
  });

  const people: ScheduleParticipant[] = useMemo(
    () => participants.map((p) => ({ id: p.id, name: [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") })),
    [participants],
  );
  const districts = useMemo(() => data?.districts ?? [], [data]);
  const allMatches = useMemo(() => districts.flatMap((d) => d.matches), [districts]);
  const districtLabels = useMemo(() => new Map(districts.map((d) => [d.id, d.label])), [districts]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";

  const scheduleMut = useMutation({
    mutationFn: async (assignments: { matchId: string; date: string | null }[]) => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשמירת הלוז");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת הלוז"),
  });

  const resultMut = useMutation({
    mutationFn: async ({ matchId, framesA, framesB }: { matchId: string; framesA: number; framesB: number }) => {
      const r = await fetch(`/api/leagues/${leagueId}/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ framesA, framesB }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשמירת התוצאה");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירת התוצאה"),
  });

  async function copyOpenMatches() {
    try {
      await navigator.clipboard.writeText(buildOpenMatchesText(leagueName, districts, people));
      toast.success("המשחקים הפתוחים הועתקו");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  async function savePasted(assignments: { matchId: string; date: string }[]) {
    await scheduleMut.mutateAsync(assignments);
    toast.success(`שובצו ${assignments.length} משחקים`);
  }

  const weekMatches = allMatches.filter(
    (m) => m.scheduled_date !== null && m.scheduled_date >= startIso && m.scheduled_date <= endIso,
  );
  const days = [...new Set(weekMatches.map((m) => m.scheduled_date as string))].sort();

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 flex-wrap">
        <p className="text-sm font-semibold">לוז</p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyOpenMatches} disabled={districts.length === 0}>
              <ClipboardCopy size={14} className="ml-1.5" />
              העתק משחקים פתוחים
            </Button>
            <Button size="sm" onClick={() => setPasteOpen(true)} disabled={districts.length === 0}>
              <ClipboardPaste size={14} className="ml-1.5" />
              הדבק לוז
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(format(addDays(parseISO(startIso), -7), "yyyy-MM-dd"))}
          aria-label="שבוע קודם"
        >
          <ChevronRight size={16} />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {shortDate(startIso)} – {shortDate(endIso)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor(format(addDays(parseISO(startIso), 7), "yyyy-MM-dd"))}
          aria-label="שבוע הבא"
        >
          <ChevronLeft size={16} />
        </Button>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">אין משחקים משובצים בשבוע הזה</p>
        ) : (
          days.map((day) => (
            <div key={day} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {dayLabelHe(day)} · {shortDate(day)}
              </p>
              {weekMatches
                .filter((m) => m.scheduled_date === day)
                .map((m) => (
                  <ScheduleRow
                    key={`${m.id}:${m.frames_a ?? ""}:${m.frames_b ?? ""}`}
                    nameA={nameOf(m.participant_a_id)}
                    nameB={nameOf(m.participant_b_id)}
                    districtLabel={districtLabels.get(m.district_id) ?? ""}
                    match={m}
                    canEdit={canEdit}
                    busy={resultMut.isPending || scheduleMut.isPending}
                    onSave={(framesA, framesB) => resultMut.mutate({ matchId: m.id, framesA, framesB })}
                    onRemove={() => scheduleMut.mutate([{ matchId: m.id, date: null }])}
                  />
                ))}
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <LeagueSchedulePasteDialog
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          participants={people}
          matches={allMatches}
          districtLabels={districtLabels}
          onSave={savePasted}
          saving={scheduleMut.isPending}
        />
      )}
    </div>
  );
}

function ScheduleRow({
  nameA,
  nameB,
  districtLabel,
  match,
  canEdit,
  busy,
  onSave,
  onRemove,
}: {
  nameA: string;
  nameB: string;
  districtLabel: string;
  match: DistrictMatch;
  canEdit: boolean;
  busy: boolean;
  onSave: (framesA: number, framesB: number) => void;
  onRemove: () => void;
}) {
  const [framesA, setFramesA] = useState(match.frames_a?.toString() ?? "");
  const [framesB, setFramesB] = useState(match.frames_b?.toString() ?? "");
  const played = match.frames_a !== null && match.frames_b !== null;

  // Saves on blur once both boxes hold a valid score — no Save button,
  // same as the tournament result inputs. Unchanged values don't resave
  // (each save re-runs the rating update).
  function trySave() {
    const a = framesA.trim();
    const b = framesB.trim();
    const na = Number(a);
    const nb = Number(b);
    if (a === "" || b === "" || !Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) return;
    if (played && na === match.frames_a && nb === match.frames_b) return;
    if (na === nb) {
      toast.error("משחק לא יכול להסתיים בתיקו");
      return;
    }
    onSave(na, nb);
  }

  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <div className="flex-1 min-w-0">
        <p className="truncate">{nameA} נגד {nameB}</p>
        <p className="text-[11px] text-muted-foreground">{districtLabel}</p>
      </div>
      {canEdit ? (
        <>
          <Input
            type="number"
            min={0}
            value={framesA}
            onChange={(e) => setFramesA(e.target.value)}
            onBlur={trySave}
            className="h-7 w-14 text-center px-1"
            disabled={busy}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            min={0}
            value={framesB}
            onChange={(e) => setFramesB(e.target.value)}
            onBlur={trySave}
            className="h-7 w-14 text-center px-1"
            disabled={busy}
          />
          {!played && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={busy}
              aria-label="הסר מהלוז"
              title="הסר מהלוז"
            >
              <X size={14} />
            </Button>
          )}
        </>
      ) : played ? (
        <span className="font-medium tabular-nums">{match.frames_a} - {match.frames_b}</span>
      ) : (
        <span className="text-muted-foreground text-xs">טרם שוחק</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the league page.** In `src/components/league-detail-view.tsx`, add next to the other component imports:

```ts
import { LeagueScheduleView } from "@/components/league-schedule-view";
```

and change:

```tsx
        <LeagueDistrictsView
```

to:

```tsx
        <LeagueScheduleView
          leagueId={leagueId}
          leagueName={league.name}
          participants={participants}
          canEdit={canEdit}
        />

        <LeagueDistrictsView
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/league-schedule-view.tsx src/components/league-detail-view.tsx
git commit -m "feat(leagues): weekly schedule section with copy/paste and result entry"
```

---

### Task 6: Manual date per match in the district lists

**Files:**
- Modify: `src/components/league-districts-view.tsx`

- [ ] **Step 1: Add the column to the local type and imports.** `DistrictMatch` becomes:

```ts
type DistrictMatch = {
  id: string;
  district_id: string;
  round: number;
  participant_a_id: string;
  participant_b_id: string;
  frames_a: number | null;
  frames_b: number | null;
  scheduled_date: string | null;
};
```

and add these imports:

```ts
import { dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";
```

- [ ] **Step 2: Add the mutation** right after the existing `resultMut` in `LeagueDistrictsView`:

```ts
  const scheduleMut = useMutation({
    mutationFn: async ({ matchId, date }: { matchId: string; date: string | null }) => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments: [{ matchId, date }] }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשיבוץ");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-districts", leagueId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשיבוץ"),
  });
```

- [ ] **Step 3: Pass it to each row.** In the `<MatchRow` element, after `saving={resultMut.isPending}` add:

```tsx
                              onSchedule={(date) => scheduleMut.mutate({ matchId: m.id, date })}
```

- [ ] **Step 4: Accept and render it in `MatchRow`.** Add `onSchedule` to the destructured props and their type:

```ts
  onSchedule,
```
```ts
  onSchedule: (date: string | null) => void;
```

and replace the row's final line:

```tsx
      {handicap && !played && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
```

with:

```tsx
      {handicap && !played && <p className="text-[11px] text-muted-foreground">{handicap}</p>}
      {canEdit && !played ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>יום משחק:</span>
          <Input
            type="date"
            value={match.scheduled_date ?? ""}
            onChange={(e) => onSchedule(e.target.value || null)}
            className="h-7 w-40 text-xs"
          />
        </div>
      ) : (
        match.scheduled_date && (
          <p className="text-[11px] text-muted-foreground">
            {dayLabelHe(match.scheduled_date)} {shortDate(match.scheduled_date)}
          </p>
        )
      )}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/league-districts-view.tsx
git commit -m "feat(leagues): set a match's play date by hand from the district list"
```

---

### Task 7: Schedule on the public league page

**Files:**
- Modify: `src/components/public-league-view.tsx`

- [ ] **Step 1: Imports.** Add:

```ts
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";
```

- [ ] **Step 2: Compute the schedule.** Right after the `lookup` function inside `PublicLeagueView`, add:

```ts
  // Everything scheduled from the start of this week (Sunday) onward —
  // last week's results already show in the standings below.
  const { startIso } = weekRangeFor(todayIsoTel());
  const districtLabel = new Map(league.districts.map((d) => [d.id, d.label]));
  const scheduled = league.districts
    .flatMap((d) => d.matches)
    .filter((m) => m.scheduled_date !== null && m.scheduled_date >= startIso);
  const scheduleDays = [...new Set(scheduled.map((m) => m.scheduled_date as string))].sort();
```

- [ ] **Step 3: Render it.** Directly after the opening of the content container:

```tsx
      <div className="px-4 py-6 flex flex-col gap-8 max-w-4xl mx-auto">
```

insert:

```tsx
        {scheduleDays.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">לוז</h2>
            <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
              {scheduleDays.map((day) => (
                <div key={day} className="px-4 py-3 flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {dayLabelHe(day)} · {shortDate(day)}
                  </p>
                  {scheduled
                    .filter((m) => m.scheduled_date === day)
                    .map((m) => {
                      const played = m.frames_a !== null && m.frames_b !== null;
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate">
                            {lookup(m.participant_a_id)?.name ?? "?"} נגד {lookup(m.participant_b_id)?.name ?? "?"}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {districtLabel.get(m.district_id)}
                          </span>
                          {played ? (
                            <span className="font-medium tabular-nums shrink-0">{m.frames_a} - {m.frames_b}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs shrink-0">טרם שוחק</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </section>
        )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/public-league-view.tsx
git commit -m "feat(leagues): show the schedule on the public league page"
```

---

### Task 8: Final verification

- [ ] `npx tsc --noEmit` — no errors.
- [ ] `npm run test:run` — 72 existing tests plus the new parse tests, all pass.
- [ ] `npm run build 2>&1 | grep -E "Compiled|Failed to compile|Import trace"` — must show "Compiled successfully". (A later "supabaseUrl is required" failure while collecting page data is the sandbox's missing env vars, not this change.) Delete the generated `public/sw.js` afterwards.
- [ ] Re-read the spec section by section against the diff.
- [ ] Tell the user: run the Task 1 migration before the deploy goes live, then try one round trip (copy open matches → AI → paste → check the public page).
