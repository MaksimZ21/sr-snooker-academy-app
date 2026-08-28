# Tournaments Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the tournaments data model and the first end-to-end slice: an admin can create a tournament and assign a manager, the admin or manager can add participants (search-existing-or-create-new against the real `students` table), mark them paid, and remove them; every coach can view tournaments read-only. House draws, results, knockout brackets, public pages, the players list, and the student personal area are explicitly **not** part of this phase — they're phases 2–6 of the same overall feature (see `docs/superpowers/specs/2026-08-11-tournaments-design.md`).

**Architecture:** Two new tables (`tournaments`, `tournament_participants`) plus three new nullable columns on the existing `students` table (`is_tournament_only`, `rating`, `public_slug`). All access goes through a new `src/lib/sheets/tournaments.ts` module (never query `db` directly from routes/components, matching this codebase's established convention). A participant is always a real `students` row — added via a search-or-create flow, never free text. `TournamentDetailView` is a single shared client component rendered by both an admin page wrapper and a coach page wrapper, with edit controls gated on `canEdit = isAdmin || currentEmail === manager_email`.

**Tech Stack:** TypeScript, Next.js 16, Supabase, Zod, TanStack Query, React 19, Tailwind CSS v4, lucide-react, shadcn/ui (`Dialog`, `Select`, `Badge`, `Button`, `Input`, `Label`, `Skeleton`).

**Spec:** `docs/superpowers/specs/2026-08-11-tournaments-design.md` (this plan covers only the "Data Model" subset needed for phase 1, "Players — Registration & Reuse", and the admin/coach tournament CRUD parts of "Navigation & Pages" — not house/knockout/public/players-list/student-area sections, which are later phases).

**Testing note:** This codebase does not unit-test `src/lib/sheets/`, API routes, or `src/components/`. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual verification in the real UI. The migration is applied manually by the user via the Supabase SQL Editor (no migration runner) — flagged explicitly in Task 1.

---

### Task 1: Database migrations

**Files:**
- Create: `supabase/migrations/20260828_tournaments_core.sql`
- Create: `supabase/migrations/20260828_students_tournament_fields.sql`

- [ ] **Step 1: Write the tournaments core migration**

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  rules_url TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  public_slug TEXT NOT NULL UNIQUE,
  handicap_points_per_rating_gap INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id),
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
```

Note: `tournament_participants.house_id` is deliberately not part of this
migration — it's added by Phase 2's migration alongside the `tournament_houses`
table it references, keeping each phase's schema change scoped to what that
phase actually uses.

- [ ] **Step 2: Write the students-fields migration**

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS is_tournament_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260828_tournaments_core.sql supabase/migrations/20260828_students_tournament_fields.sql
git commit -m "feat(tournaments): add tournaments schema and student fields migration"
```

- [ ] **Step 4: Note for the user**

This migration is **not** applied automatically — flag clearly in your final
report that the user must run both files' SQL manually in the Supabase SQL
Editor before any of this phase's features will work end-to-end (the app
will still compile without it, but every tournament API call will fail
until the tables/columns exist).

---

### Task 2: Extend the `Student` schema and `appendStudent`

**Files:**
- Modify: `src/lib/sheets/schemas.ts`
- Modify: `src/lib/sheets/students.ts`

- [ ] **Step 1: Add the three new fields to `StudentRow`**

Change:
```ts
export const StudentRow = z.object({
  id: z.string().min(1),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  college_name: z.string().default(""),
  subscription_type: z.string().default(""),
  general_notes: z.string().default(""),
  birth_date: z.string().nullable().default(null),
  last_payment_date: z.string().nullable().default(null),
  active: Bool,
});
```
to:
```ts
export const StudentRow = z.object({
  id: z.string().min(1),
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  college_name: z.string().default(""),
  subscription_type: z.string().default(""),
  general_notes: z.string().default(""),
  birth_date: z.string().nullable().default(null),
  last_payment_date: z.string().nullable().default(null),
  active: Bool,
  is_tournament_only: z.boolean().default(false),
  rating: z.number().default(1000),
  public_slug: z.string().nullable().default(null),
});
```

These three are real Postgres columns (`BOOLEAN`, `INT`, `TEXT`) per Task 1's
migration, not the legacy sheets-era string-encoded columns — so unlike
`active`'s `Bool` preprocessor, they don't need string coercion.

- [ ] **Step 2: Extend `appendStudent` to accept the three new optional fields**

Change:
```ts
export async function appendStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
  last_payment_date?: string | null;
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    college_name: input.college_name ?? "",
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    last_payment_date: input.last_payment_date ?? null,
    active: true,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
```
to:
```ts
export async function appendStudent(input: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college_name?: string;
  subscription_type?: string;
  general_notes?: string;
  birth_date?: string | null;
  last_payment_date?: string | null;
  active?: boolean;
  is_tournament_only?: boolean;
  rating?: number;
  public_slug?: string | null;
}) {
  const { data } = await db.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => parseInt((r.id as string).slice(1), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const id = `S${String(next).padStart(3, "0")}`;
  await db.from("students").insert({
    id,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    college_name: input.college_name ?? "",
    subscription_type: input.subscription_type ?? "",
    general_notes: input.general_notes ?? "",
    birth_date: input.birth_date ?? null,
    last_payment_date: input.last_payment_date ?? null,
    active: input.active ?? true,
    is_tournament_only: input.is_tournament_only ?? false,
    rating: input.rating ?? 1000,
    public_slug: input.public_slug ?? null,
  });
  revalidateTag("students", { expire: 0 });
  return id;
}
```

Every existing caller of `appendStudent` (the CRM webhook, the admin
students page) omits these four new fields entirely, so they keep getting
exactly the same defaults as before (`active: true`,
`is_tournament_only: false`, `rating: 1000`, `public_slug: null`) — this
change is purely additive and backward-compatible.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this is a purely additive type/signature change; no
existing caller breaks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/schemas.ts src/lib/sheets/students.ts
git commit -m "feat(tournaments): extend Student schema and appendStudent with tournament fields"
```

---

### Task 3: `tournaments.ts` — tournament CRUD

**Files:**
- Create: `src/lib/sheets/tournaments.ts`

- [ ] **Step 1: Write the tournament types and CRUD functions**

```ts
import { db } from "@/lib/db/client";

export type Tournament = {
  id: string;
  name: string;
  manager_email: string;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  created_at: string;
};

export type TournamentParticipantWithStudent = TournamentParticipant & {
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

export type TournamentDetail = {
  tournament: Tournament;
  participants: TournamentParticipantWithStudent[];
};

export function isTournamentManager(tournament: Tournament, user: { email: string; role: string }): boolean {
  return user.role === "admin" || tournament.manager_email.toLowerCase() === user.email.toLowerCase();
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data } = await db.from("tournaments").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Tournament[];
}

export async function fetchTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const { data: tournament } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
  if (!tournament) return null;

  const { data: participantRows } = await db
    .from("tournament_participants")
    .select("*")
    .eq("tournament_id", id)
    .order("created_at", { ascending: true });

  const participants = (participantRows ?? []) as TournamentParticipant[];
  const studentIds = participants.map((p) => p.student_id);
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone, rating").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string; rating: number }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return {
    tournament: tournament as Tournament,
    participants: participants.map((p) => ({
      ...p,
      student: studentsById.get(p.student_id) ?? { id: p.student_id, first_name: "(נמחק)", last_name: "", phone: "", rating: 1000 },
    })),
  };
}

export async function createTournament(input: {
  name: string;
  manager_email: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
}): Promise<Tournament> {
  const { generatePublicSlug } = await import("./tournaments-slug");
  const { data, error } = await db
    .from("tournaments")
    .insert({
      name: input.name,
      manager_email: input.manager_email,
      rules_url: input.rules_url ?? null,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}

export async function updateTournament(
  id: string,
  input: {
    name?: string;
    manager_email?: string;
    rules_url?: string | null;
    handicap_points_per_rating_gap?: number;
    completed?: boolean;
  },
): Promise<void> {
  const { error } = await db.from("tournaments").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}
```

Note: `createTournament` dynamically imports `generatePublicSlug` from a new
`./tournaments-slug` module — that module is created in Task 4 (which also
needs the same helper for participants). Splitting the slug generator into
its own tiny file avoids a circular/forward-reference concern within this
same file's Task 3/Task 4 split; the dynamic `import()` keeps Task 3
buildable and typecheckable on its own before Task 4 exists.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: an error on the `import("./tournaments-slug")` line, since that
module doesn't exist yet — this is expected and resolved by Task 4. Confirm
no other, unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournaments.ts
git commit -m "feat(tournaments): add tournament CRUD data module"
```

---

### Task 4: `tournaments.ts` — participants (search-or-create)

**Files:**
- Create: `src/lib/sheets/tournaments-slug.ts`
- Modify: `src/lib/sheets/tournaments.ts`

- [ ] **Step 1: Write the slug generator module**

```ts
import { randomBytes } from "crypto";

// URL-safe, ~12-character unguessable slug — used for both tournament and
// player public links (/t/[slug], /p/[slug]). Not a sequential id: anyone
// with the link can view the page, so it must not be enumerable.
export function generatePublicSlug(): string {
  return randomBytes(9).toString("base64url");
}
```

- [ ] **Step 2: Add participant functions to `tournaments.ts`**

Add these to the end of `src/lib/sheets/tournaments.ts`:

```ts
export type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

export async function searchStudents(query: string): Promise<StudentSearchResult[]> {
  const q = query.trim().replace(/,/g, " ");
  if (!q) return [];
  const { data } = await db
    .from("students")
    .select("id, first_name, last_name, phone")
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(15);
  return (data ?? []) as StudentSearchResult[];
}

export async function addTournamentParticipant(
  tournamentId: string,
  input: { studentId?: string; newStudentName?: string },
): Promise<TournamentParticipant> {
  const { appendStudent } = await import("./students");
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
    // Existing student — this may be their first-ever tournament, in which
    // case they don't have a public_slug yet. Generate one now, lazily,
    // exactly once (never overwritten on subsequent tournaments).
    const { data: existing } = await db.from("students").select("public_slug").eq("id", studentId).maybeSingle();
    if (existing && !existing.public_slug) {
      await db.from("students").update({ public_slug: generatePublicSlug() }).eq("id", studentId);
    }
  }

  const { data, error } = await db
    .from("tournament_participants")
    .insert({ tournament_id: tournamentId, student_id: studentId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TournamentParticipant;
}

export async function setParticipantPaid(participantId: string, paid: boolean): Promise<void> {
  const { error } = await db.from("tournament_participants").update({ paid }).eq("id", participantId);
  if (error) throw new Error(error.message);
}

export async function removeTournamentParticipant(participantId: string): Promise<void> {
  const { error } = await db.from("tournament_participants").delete().eq("id", participantId);
  if (error) throw new Error(error.message);
}
```

Also change `createTournament`'s slug import from a dynamic `import()` to a
static one now that `tournaments-slug.ts` exists — change:
```ts
export async function createTournament(input: {
  name: string;
  manager_email: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
}): Promise<Tournament> {
  const { generatePublicSlug } = await import("./tournaments-slug");
  const { data, error } = await db
```
to:
```ts
export async function createTournament(input: {
  name: string;
  manager_email: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
}): Promise<Tournament> {
  const { data, error } = await db
```
and add a static import at the top of the file, alongside the existing
`import { db } from "@/lib/db/client";` line:
```ts
import { db } from "@/lib/db/client";
import { generatePublicSlug } from "./tournaments-slug";
```

Note: `addTournamentParticipant` still uses a dynamic `import("./students")`
for `appendStudent` — this is deliberate, not an oversight, to avoid a
circular import (`students.ts` doesn't import `tournaments.ts`, so a static
import would actually be fine too, but the dynamic form here keeps this
function's dependency explicit and colocated; either works, don't change it
unless it causes an actual problem).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — this resolves the forward-reference from Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/tournaments-slug.ts src/lib/sheets/tournaments.ts
git commit -m "feat(tournaments): add participant search-or-create and slug generation"
```

---

### Task 5: API routes — tournaments

**Files:**
- Create: `src/app/api/tournaments/route.ts`
- Create: `src/app/api/tournaments/[id]/route.ts`

- [ ] **Step 1: Write `src/app/api/tournaments/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournaments, createTournament } from "@/lib/sheets/tournaments";

export async function GET() {
  try {
    await requireUser();
    const tournaments = await fetchTournaments();
    return NextResponse.json({ tournaments });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().min(1),
  manager_email: z.email(),
  rules_url: z.string().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = CreateSchema.parse(await req.json());
    const tournament = await createTournament(body);
    return NextResponse.json({ tournament });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/tournaments/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, updateTournament, isTournamentManager } from "@/lib/sheets/tournaments";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await params;
    const detail = await fetchTournamentDetail(id);
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
  rules_url: z.string().nullable().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(
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
    const body = UpdateSchema.parse(await req.json());
    await updateTournament(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

Both routes are reachable by admin and any coach for `GET` (matching the
spec's "other coaches see the tournament, view-only"); `PATCH` is gated to
admin or the assigned manager via `isTournamentManager`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tournaments/route.ts "src/app/api/tournaments/[id]/route.ts"
git commit -m "feat(tournaments): add tournament list/create/detail/update API routes"
```

---

### Task 6: API routes — participants and student search

**Files:**
- Create: `src/app/api/tournaments/[id]/participants/route.ts`
- Create: `src/app/api/tournaments/[id]/participants/[participantId]/route.ts`
- Create: `src/app/api/students/search/route.ts`

- [ ] **Step 1: Write `src/app/api/tournaments/[id]/participants/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, addTournamentParticipant, isTournamentManager } from "@/lib/sheets/tournaments";

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
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = AddSchema.parse(await req.json());
    const participant = await addTournamentParticipant(id, body);
    return NextResponse.json({ participant });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `src/app/api/tournaments/[id]/participants/[participantId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, setParticipantPaid, removeTournamentParticipant, isTournamentManager } from "@/lib/sheets/tournaments";

const PatchSchema = z.object({ paid: z.boolean() });

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
    const { paid } = PatchSchema.parse(await req.json());
    await setParticipantPaid(participantId, paid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
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
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await removeTournamentParticipant(participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Write `src/app/api/students/search/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { searchStudents } from "@/lib/sheets/tournaments";

export async function GET(req: Request) {
  try {
    await requireUser();
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const students = await searchStudents(q);
    return NextResponse.json({ students });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

Reachable by both admin and coach (any authenticated user) — it's the
backing search for the participant picker, which any manager (a coach) uses.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/tournaments/[id]/participants/route.ts" "src/app/api/tournaments/[id]/participants/[participantId]/route.ts" src/app/api/students/search/route.ts
git commit -m "feat(tournaments): add participant add/paid/remove and student search API routes"
```

---

### Task 7: Nav items and the participant picker component

**Files:**
- Modify: `src/components/nav-items.ts`
- Create: `src/components/tournament-participant-picker.tsx`

- [ ] **Step 1: Add nav entries**

Change:
```ts
export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/sessions", label: "האימונים שלי", icon: "History" },
  { href: "/coach/students", label: "מתאמנים", icon: "Users" },
  { href: "/coach/salary", label: "פיננסים", icon: "Banknote" },
  { href: "/coach/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/coach/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];
```
to:
```ts
export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/sessions", label: "האימונים שלי", icon: "History" },
  { href: "/coach/students", label: "מתאמנים", icon: "Users" },
  { href: "/coach/tournaments", label: "טורנירים", icon: "Trophy" },
  { href: "/coach/salary", label: "פיננסים", icon: "Banknote" },
  { href: "/coach/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/coach/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];
```

Change:
```ts
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/messages", label: "פניות", icon: "MessageSquare" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { href: "/admin/webhook-logs", label: "לוגים CRM", icon: "Activity" },
  { href: "/admin/salary", label: "פיננסים", icon: "Banknote" },
  { href: "/admin/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```
to:
```ts
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/tournaments", label: "טורנירים", icon: "Trophy" },
  { href: "/admin/messages", label: "פניות", icon: "MessageSquare" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { href: "/admin/webhook-logs", label: "לוגים CRM", icon: "Activity" },
  { href: "/admin/salary", label: "פיננסים", icon: "Banknote" },
  { href: "/admin/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

(If `AppShell`'s icon renderer requires every `icon` string to be a known
key in some lookup map rather than resolving any lucide-react export by
name, check that file — e.g. `src/components/app-shell.tsx` — and add
`Trophy` to it the same way other icons are registered there. If it already
resolves icons dynamically by name from `lucide-react`, no extra step is
needed.)

- [ ] **Step 2: Write the participant picker component**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type StudentSearchResult = { id: string; first_name: string; last_name: string; phone: string };

export function TournamentParticipantPicker({ tournamentId }: { tournamentId: string }) {
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["students:search", query],
    queryFn: async () => {
      const r = await fetch(`/api/students/search?q=${encodeURIComponent(query)}`);
      return (await r.json()) as { students: StudentSearchResult[] };
    },
    enabled: query.trim().length >= 2,
  });

  const addMut = useMutation({
    mutationFn: async (body: { studentId?: string; newStudentName?: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("משתתף נוסף");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת משתתף"),
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
            {`+ הוסף כמשתתף חדש: "${query.trim()}"`}
          </button>
        </div>
      )}
    </div>
  );
}
```

Note: this re-fetches on every keystroke past 2 characters rather than
debouncing — acceptable for V1 given this is a small internal-tool dataset;
worth revisiting only if it's ever felt to be slow in practice.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-items.ts src/components/tournament-participant-picker.tsx
git commit -m "feat(tournaments): add nav entries and participant picker component"
```

---

### Task 8: `TournamentDetailView` component

**Files:**
- Create: `src/components/tournament-detail-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Trophy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";

type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; phone: string; rating: number };
};

type Tournament = {
  id: string;
  name: string;
  manager_email: string;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  created_at: string;
};

export function TournamentDetailView({
  tournamentId,
  backHref,
  currentEmail,
  isAdmin,
}: {
  tournamentId: string;
  backHref: string;
  currentEmail: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { tournament: Tournament; participants: TournamentParticipant[] };
    },
  });

  const paidMut = useMutation({
    mutationFn: async ({ participantId, paid }: { participantId: string; paid: boolean }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const removeMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("משתתף הוסר");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהסרה"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const { tournament, participants } = data;
  const canEdit = isAdmin || tournament.manager_email.toLowerCase() === currentEmail.toLowerCase();
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${tournament.public_slug}` : "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Trophy size={20} />}
        title={tournament.name}
        subtitle={`מנהל: ${tournament.manager_email}${tournament.completed ? " · הסתיים" : ""}`}
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
              /t/{tournament.public_slug}
              <ExternalLink size={12} />
            </a>
          </div>
          {tournament.rules_url && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">תקנון:</span>
              <a href={tournament.rules_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                קישור לתקנון
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">מקדם פור:</span>
            <span>{tournament.handicap_points_per_rating_gap}</span>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">הוספת משתתף</p>
            <TournamentParticipantPicker tournamentId={tournamentId} />
          </div>
        )}

        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 pt-3 pb-1">
            {`משתתפים (${participants.length})`}
          </p>
          {participants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין משתתפים עדיין</div>
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
                    <button
                      type="button"
                      onClick={() => paidMut.mutate({ participantId: p.id, paid: !p.paid })}
                      disabled={paidMut.isPending}
                    >
                      <Badge variant={p.paid ? "default" : "secondary"} className="cursor-pointer">
                        {p.paid ? "שולם" : "לא שולם"}
                      </Badge>
                    </button>
                  ) : (
                    <Badge variant={p.paid ? "default" : "secondary"}>{p.paid ? "שולם" : "לא שולם"}</Badge>
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
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tournament-detail-view.tsx
git commit -m "feat(tournaments): add shared tournament detail view component"
```

---

### Task 9: Pages — admin and coach tournament list/detail

**Files:**
- Create: `src/app/(admin)/admin/tournaments/page.tsx`
- Create: `src/app/(admin)/admin/tournaments/[id]/page.tsx`
- Create: `src/app/(coach)/coach/tournaments/page.tsx`
- Create: `src/app/(coach)/coach/tournaments/[id]/page.tsx`

- [ ] **Step 1: Write `src/app/(admin)/admin/tournaments/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Plus, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
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

type Tournament = { id: string; name: string; manager_email: string; completed: boolean; public_slug: string };
type Coach = { email: string; name: string; phone: string };

export default function AdminTournamentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [rulesUrl, setRulesUrl] = useState("");
  const [handicapGap, setHandicapGap] = useState("20");

  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const r = await fetch("/api/tournaments");
      return (await r.json()) as { tournaments: Tournament[] };
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
      const r = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          manager_email: managerEmail,
          rules_url: rulesUrl.trim() || undefined,
          handicap_points_per_rating_gap: Number(handicapGap) || undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { tournament: Tournament };
    },
    onSuccess: ({ tournament }) => {
      toast.success("הטורניר נוצר");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      setOpen(false);
      setName("");
      setManagerEmail("");
      setRulesUrl("");
      setHandicapGap("20");
      router.push(`/admin/tournaments/${tournament.id}`);
    },
    onError: () => toast.error("שגיאה ביצירה"),
  });

  const tournaments = data?.tournaments ?? [];
  const active = tournaments.filter((t) => !t.completed);
  const completed = tournaments.filter((t) => t.completed);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Trophy size={20} />}
        title="טורנירים"
        subtitle={isLoading ? "טוען..." : `${tournaments.length} טורנירים`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus size={14} className="ml-1.5" />
              טורניר חדש
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>טורניר חדש</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שם הטורניר</Label>
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
                  <Label className="text-xs text-muted-foreground mb-1 block">קישור לתקנון (אופציונלי)</Label>
                  <Input value={rulesUrl} onChange={(e) => setRulesUrl(e.target.value)} dir="ltr" placeholder="https://..." />
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
            <TournamentGroup title="פעילים" items={active} basePath="/admin" />
            {completed.length > 0 && <TournamentGroup title="הסתיימו" items={completed} basePath="/admin" />}
          </>
        )}
      </div>
    </div>
  );
}

function TournamentGroup({ title, items, basePath }: { title: string; items: Tournament[]; basePath: string }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          אין טורנירים
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((t) => (
          <Link
            key={t.id}
            href={`${basePath}/tournaments/${t.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{t.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/(admin)/admin/tournaments/[id]/page.tsx`**

```tsx
import { TournamentDetailView } from "@/components/tournament-detail-view";

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TournamentDetailView tournamentId={id} backHref="/admin/tournaments" currentEmail="" isAdmin={true} />
  );
}
```

`currentEmail` is irrelevant when `isAdmin` is `true` (`canEdit` short-
circuits on `isAdmin` in the component) — passed as an empty string rather
than fetched, since the `(admin)` layout already guarantees the user is an
admin before this page renders at all.

- [ ] **Step 3: Write `src/app/(coach)/coach/tournaments/page.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type Tournament = { id: string; name: string; manager_email: string; completed: boolean; public_slug: string };

export default function CoachTournamentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const r = await fetch("/api/tournaments");
      return (await r.json()) as { tournaments: Tournament[] };
    },
  });

  const tournaments = data?.tournaments ?? [];
  const active = tournaments.filter((t) => !t.completed);
  const completed = tournaments.filter((t) => t.completed);

  return (
    <div className="flex flex-col">
      <PageHeader icon={<Trophy size={20} />} title="טורנירים" subtitle={isLoading ? "טוען..." : `${tournaments.length} טורנירים`} />
      <div className="p-4 md:p-6 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">אין טורנירים</div>
        ) : (
          <>
            <TournamentList title="פעילים" items={active} />
            {completed.length > 0 && <TournamentList title="הסתיימו" items={completed} />}
          </>
        )}
      </div>
    </div>
  );
}

function TournamentList({ title, items }: { title: string; items: Tournament[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
        {items.map((t) => (
          <Link
            key={t.id}
            href={`/coach/tournaments/${t.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <span className="flex-1 text-sm font-medium">{t.name}</span>
            <ChevronLeft size={14} className="text-muted-foreground/30 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/(coach)/coach/tournaments/[id]/page.tsx`**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TournamentDetailView } from "@/components/tournament-detail-view";

export default async function CoachTournamentDetailPage({
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
    <TournamentDetailView
      tournamentId={id}
      backHref="/coach/tournaments"
      currentEmail={session?.user.email ?? ""}
      isAdmin={false}
    />
  );
}
```

This is the one page that needs to know the specific logged-in coach's
email (to compare against `manager_email` and decide `canEdit`), since the
`(coach)` layout only guarantees "some coach," not which one.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/tournaments/page.tsx" "src/app/(admin)/admin/tournaments/[id]/page.tsx" "src/app/(coach)/coach/tournaments/page.tsx" "src/app/(coach)/coach/tournaments/[id]/page.tsx"
git commit -m "feat(tournaments): add admin and coach tournament list/detail pages"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature touches no tested
files).

- [ ] **Step 3: Remind the user about the manual migration**

Before any manual QA can show real results, the user must run Task 1's two
migration files in the Supabase SQL Editor. State this explicitly and wait
for confirmation before asking them to test.

- [ ] **Step 4: Manual end-to-end verification**

Once the migration is applied and the app is deployed:

1. As admin, go to `/admin/tournaments`, click "טורניר חדש", fill in a
   name and pick a manager coach, save — confirm it navigates to the new
   tournament's detail page and the public link (`/t/[slug]`) is shown
   (the page itself at that URL doesn't exist yet — that's Phase 4 — a
   404/blank page there is expected for now).
2. In the detail page, search for an existing student by name — confirm
   matches appear with phone numbers, and clicking one adds them as a
   participant instantly (no page reload needed).
3. Type a name with no existing match and click "הוסף כמשתתף חדש" —
   confirm a new participant appears; separately confirm in
   `/admin/students` that this new "student" does **not** appear there
   (since `is_tournament_only` should exclude them from that list — note:
   Phase 1 doesn't add that filter to `/admin/students` itself, so if it's
   not filtered yet, that's an expected, deferred gap, not a bug in this
   phase — mention this explicitly rather than silently noting a false
   pass or fail).
4. Toggle a participant's paid badge — confirm it updates immediately.
   Remove a participant — confirm they disappear from the list.
5. As a non-manager coach, open the same tournament via `/coach/tournaments`
   — confirm you can see everything but there's no "add participant" box,
   no paid-toggle (badge is view-only), and no remove buttons.
6. As the assigned manager coach, open it via `/coach/tournaments` —
   confirm full edit access identical to admin.
7. Create a second tournament and mark it completed via... note: Phase 1
   doesn't add a UI control for `completed` yet (only the API supports it)
   — if you want to test toggling `completed`, do it via a direct `PATCH`
   call or just confirm the list correctly separates "פעילים"/"הסתיימו"
   sections based on whatever `completed` value exists in the DB. This is
   an acceptable, expected gap for this phase — a UI toggle can be added
   in a later phase's polish pass if wanted, but wasn't part of this plan's
   scope.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check in Step 4, explicitly confirm the
migration reminder was acknowledged, and clearly state that this is Phase 1
of 6 — no house draw, results, knockout bracket, public pages, players
list, or student personal area exist yet; those are separate upcoming
plans per `docs/superpowers/specs/2026-08-11-tournaments-design.md`.

---

## Plan Self-Review Notes

- **Spec coverage (phase-scoped):** covers exactly the "Data Model" rows
  needed for phase 1 (`tournaments`, `tournament_participants`, the three
  new `students` columns — explicitly NOT `tournament_houses`,
  `tournament_house_matches`, `tournament_knockout_matches`, which are
  later phases), all of "Players — Registration & Reuse", and the
  admin/coach CRUD portions of "Navigation & Pages" and "Roles &
  Permissions". Rating/ELO, handicap display, public pages, players list,
  and the student personal area are explicitly out of this plan's scope —
  called out in the Goal section and Task 10 Step 5 so this isn't mistaken
  for a complete implementation of the full spec.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `Tournament`, `TournamentParticipant`,
  `TournamentParticipantWithStudent` are defined once in
  `src/lib/sheets/tournaments.ts` (Task 3) and the exact same shapes are
  re-declared inline in the two client components (Tasks 7–8) — matching
  field names throughout (`manager_email`, `public_slug`,
  `handicap_points_per_rating_gap`, etc.), since this codebase's existing
  API routes return raw JSON rather than a shared generated client, and
  other features in this codebase (e.g. `ScheduledMessage`) follow the
  same "type re-declared at each consumer" convention rather than a shared
  package.
- **Sequencing:** Task 3 knowingly introduces one forward-reference error
  (importing a not-yet-created `tournaments-slug.ts`), explicitly flagged
  in its typecheck step so it isn't mistaken for a real problem; Task 4
  resolves it immediately after. Every other task's typecheck step expects
  a fully clean `tsc` run.
