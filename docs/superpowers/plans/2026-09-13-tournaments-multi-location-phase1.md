# Multi-Location Tournaments Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `multi_location` tournament type: manual locations, manual houses within each location, manual participant assignment at both levels, per-house standings — finishing into the existing, unchanged, manually-placed knockout bracket. `regular` tournaments keep working exactly as they do today.

**Architecture:** One migration adding `tournaments.type`, `tournament_locations`, and two new nullable FK columns. One new data-layer module (`tournament-locations.ts`) plus targeted additions to the existing `tournament-houses.ts`. New API routes mirroring the existing tournament-houses route shapes exactly. Two UI additions: a type selector at tournament creation, and a new `TournamentLocationsView` component that renders instead of `TournamentHousesView` for this type — `TournamentKnockoutView` is untouched and used by both types identically.

**Tech Stack:** Next.js 16 App Router, TypeScript strict mode, Tailwind CSS v4, React 19, shadcn/ui, TanStack Query, zod, Supabase.

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260913_tournament_locations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Multi-location tournaments: a tournament is either 'regular' (today's
-- format, unchanged — random house draw, single knockout) or
-- 'multi_location' (manual locations, each with manually-built houses,
-- finishing into the same shared, manually-placed knockout bracket).

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'regular'
  CHECK (type IN ('regular', 'multi_location'));

CREATE TABLE tournament_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tournament_locations(id) ON DELETE SET NULL;

ALTER TABLE tournament_houses
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tournament_locations(id) ON DELETE SET NULL;

ALTER TABLE tournament_locations ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration**

This project has no local Supabase CLI/config wired up (no `supabase/config.toml`, no migration script in `package.json`) — every prior migration in this repo (including `20260913_leagues.sql`, the immediately preceding one) was applied by running its SQL directly against the project's Supabase instance via the Supabase dashboard's SQL editor. Apply this migration the same way before moving on to any task that depends on these columns/table existing.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260913_tournament_locations.sql
git commit -m "chore(tournaments): add multi-location tournaments migration"
```

---

### Task 2: `tournaments.ts` — type field

**Files:**
- Modify: `src/lib/sheets/tournaments.ts`

- [ ] **Step 1: Widen the `Tournament` and `TournamentParticipant` types, and thread `type` through `createTournament`**

In `src/lib/sheets/tournaments.ts`, change the `Tournament` type to:

```ts
export type Tournament = {
  id: string;
  name: string;
  manager_email: string;
  rules_url: string | null;
  completed: boolean;
  public_slug: string;
  handicap_points_per_rating_gap: number;
  type: "regular" | "multi_location";
  created_at: string;
};
```

Change the `TournamentParticipant` type to:

```ts
export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  location_id: string | null;
  house_id: string | null;
  created_at: string;
};
```

Change `createTournament` to:

```ts
export async function createTournament(input: {
  name: string;
  manager_email: string;
  rules_url?: string;
  handicap_points_per_rating_gap?: number;
  type?: "regular" | "multi_location";
}): Promise<Tournament> {
  const { data, error } = await db
    .from("tournaments")
    .insert({
      name: input.name,
      manager_email: input.manager_email,
      rules_url: input.rules_url ?? null,
      handicap_points_per_rating_gap: input.handicap_points_per_rating_gap ?? 20,
      type: input.type ?? "regular",
      public_slug: generatePublicSlug(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}
```

Nothing else in this file changes — `fetchTournamentDetail`/`fetchTournaments` already `select("*")`, so the new columns flow through automatically once the types above are widened.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in every other file that constructs a `Tournament` or `TournamentParticipant` object without the new required fields, OR no errors if none do (these are read-only types built from `select("*")` results almost everywhere, cast with `as Tournament`, so this step is likely already clean — confirm either way).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournaments.ts
git commit -m "feat(tournaments): add type field to Tournament/TournamentParticipant"
```

---

### Task 3: `tournament-locations.ts` data layer

**Files:**
- Create: `src/lib/sheets/tournament-locations.ts`

- [ ] **Step 1: Write the module**

```ts
import { db } from "@/lib/db/client";

export type TournamentLocation = { id: string; tournament_id: string; label: string };

export async function fetchTournamentLocations(tournamentId: string): Promise<TournamentLocation[]> {
  const { data } = await db
    .from("tournament_locations")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("label");
  return (data ?? []) as TournamentLocation[];
}

export async function addTournamentLocation(tournamentId: string, label: string): Promise<TournamentLocation> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, type")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) throw new Error("tournament not found");
  if (tournament.type !== "multi_location") {
    throw new Error("locations can only be added to a multi-location tournament");
  }

  const { data, error } = await db
    .from("tournament_locations")
    .insert({ tournament_id: tournamentId, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as TournamentLocation;
}

export async function assignParticipantToLocation(
  tournamentId: string,
  participantId: string,
  locationId: string | null,
): Promise<void> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("id, type")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tournament) throw new Error("tournament not found");
  if (tournament.type !== "multi_location") {
    throw new Error("location assignment only applies to a multi-location tournament");
  }

  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id, house_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // A house belongs to exactly one location — changing location while the
  // participant is still placed in a house would silently disagree with
  // that house's own location. The manager must explicitly remove them
  // from their house first (removeParticipantFromHouse) — no implicit
  // cascade, same "explicit guard over silent side effects" rule already
  // used throughout this codebase's tournament/league guards.
  if (participant.house_id) {
    throw new Error(
      "cannot change location while the participant is still assigned to a house — remove them from their house first",
    );
  }

  if (locationId) {
    const { data: location } = await db
      .from("tournament_locations")
      .select("id, tournament_id")
      .eq("id", locationId)
      .maybeSingle();
    if (!location || location.tournament_id !== tournamentId) throw new Error("location not found");
  }

  const { error } = await db
    .from("tournament_participants")
    .update({ location_id: locationId })
    .eq("id", participantId);
  if (error) throw new Error(error.message);
}
```

No test file for this — matches the established precedent for this kind of thin, guard-heavy data-composition module (`league-districts.ts` and `leagues.ts` have no dedicated test files either).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/tournament-locations.ts
git commit -m "feat(tournaments): add tournament-locations data layer"
```

---

### Task 4: `tournament-houses.ts` — location-aware houses

**Files:**
- Modify: `src/lib/sheets/tournament-houses.ts`

- [ ] **Step 1: Widen the `House` type**

Change:

```ts
export type House = { id: string; tournament_id: string; label: string };
```

to:

```ts
export type House = { id: string; tournament_id: string; label: string; location_id: string | null };
```

- [ ] **Step 2: Guard `runHouseDraw` to `regular` tournaments only**

Change the start of `runHouseDraw` from:

```ts
export async function runHouseDraw(tournamentId: string, numHouses: number): Promise<void> {
  const { data: participantRows } = await db
```

to:

```ts
export async function runHouseDraw(tournamentId: string, numHouses: number): Promise<void> {
  const { data: tournament } = await db.from("tournaments").select("id, type").eq("id", tournamentId).maybeSingle();
  if (!tournament) throw new Error("tournament not found");
  if (tournament.type !== "regular") {
    throw new Error("a random house draw only applies to a regular tournament");
  }

  const { data: participantRows } = await db
```

(the rest of the function body is unchanged)

- [ ] **Step 3: Add `addLocationHouse`**

Add this new function, placed directly after `runHouseDraw`:

```ts
// The manual equivalent of runHouseDraw for a multi-location tournament:
// creates one empty house within a specific location — no shuffle, no
// participants assigned yet. The manager fills it afterward, one
// participant at a time, via moveParticipantToHouse.
export async function addLocationHouse(tournamentId: string, locationId: string, label: string): Promise<House> {
  const { data: location } = await db
    .from("tournament_locations")
    .select("id, tournament_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!location || location.tournament_id !== tournamentId) throw new Error("location not found");

  const { data, error } = await db
    .from("tournament_houses")
    .insert({ tournament_id: tournamentId, location_id: locationId, label })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as House;
}
```

- [ ] **Step 4: Add a location-congruency check to `moveParticipantToHouse`**

Change the start of `moveParticipantToHouse` from:

```ts
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
    .select("id, tournament_id, house_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // Already in the target house — nothing to do, and definitely don't wipe
```

to:

```ts
export async function moveParticipantToHouse(
  tournamentId: string,
  participantId: string,
  newHouseId: string,
): Promise<void> {
  const { data: house } = await db
    .from("tournament_houses")
    .select("id, tournament_id, location_id")
    .eq("id", newHouseId)
    .maybeSingle();
  if (!house || house.tournament_id !== tournamentId) throw new Error("house not found");

  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id, house_id, location_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");

  // A multi-location tournament's houses each belong to exactly one
  // location — a participant can only be placed into a house within the
  // location they're already assigned to. For a regular tournament both
  // sides of this comparison are always null, so the check is a no-op there.
  if (house.location_id !== participant.location_id) {
    throw new Error("a participant can only be placed into a house within their own assigned location");
  }

  // Already in the target house — nothing to do, and definitely don't wipe
```

(everything else in the function is unchanged)

- [ ] **Step 5: Add `removeParticipantFromHouse`**

Add this new function, placed directly after `moveParticipantToHouse`:

```ts
// The explicit "הסר משיבוץ" action — required before a participant's
// location can be changed once they're already placed in a house (see
// assignParticipantToLocation's guard). Refuses if any of their pending
// matches in that house already has a result, same rule moveParticipantToHouse
// already applies.
export async function removeParticipantFromHouse(tournamentId: string, participantId: string): Promise<void> {
  const { data: participant } = await db
    .from("tournament_participants")
    .select("id, tournament_id, house_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.tournament_id !== tournamentId) throw new Error("participant not found");
  if (!participant.house_id) return; // already not in a house — nothing to do

  const { data: existingMatches } = await db
    .from("tournament_house_matches")
    .select("frames_a")
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);
  const hasPlayedMatch = (existingMatches ?? []).some((m) => m.frames_a !== null);
  if (hasPlayedMatch) {
    throw new Error("cannot remove a participant who has already played a match in their current house");
  }

  const { error: deleteError } = await db
    .from("tournament_house_matches")
    .delete()
    .or(`participant_a_id.eq.${participantId},participant_b_id.eq.${participantId}`);
  if (deleteError) throw new Error(deleteError.message);

  const { error: updateError } = await db
    .from("tournament_participants")
    .update({ house_id: null })
    .eq("id", participantId);
  if (updateError) throw new Error(updateError.message);
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheets/tournament-houses.ts
git commit -m "feat(tournaments): add location-aware guards, addLocationHouse, removeParticipantFromHouse"
```

---

### Task 5: API routes

**Files:**
- Create: `src/app/api/tournaments/[id]/locations/route.ts`
- Create: `src/app/api/tournaments/[id]/locations/[locationId]/houses/route.ts`
- Create: `src/app/api/tournaments/[id]/participants/[participantId]/location/route.ts`
- Modify: `src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts`
- Modify: `src/app/api/tournaments/route.ts`

- [ ] **Step 1: `src/app/api/tournaments/[id]/locations/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { fetchTournamentLocations, addTournamentLocation } from "@/lib/sheets/tournament-locations";

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
    const locations = await fetchTournamentLocations(id);
    return NextResponse.json({ locations });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

const AddSchema = z.object({ label: z.string().min(1) });

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
    const { label } = AddSchema.parse(await req.json());
    const location = await addTournamentLocation(id, label);
    return NextResponse.json({ location });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: `src/app/api/tournaments/[id]/locations/[locationId]/houses/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { addLocationHouse } from "@/lib/sheets/tournament-houses";

const AddSchema = z.object({ label: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, locationId } = await params;
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { label } = AddSchema.parse(await req.json());
    const house = await addLocationHouse(id, locationId, label);
    return NextResponse.json({ house });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: `src/app/api/tournaments/[id]/participants/[participantId]/location/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { assignParticipantToLocation } from "@/lib/sheets/tournament-locations";

const AssignSchema = z.object({ locationId: z.string().min(1).nullable() });

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
    const { locationId } = AssignSchema.parse(await req.json());
    await assignParticipantToLocation(id, participantId, locationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add a `DELETE` handler to `src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts`**

Replace the full contents of this file with (adds a `DELETE` export; the existing `PATCH` export is unchanged):

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchTournamentDetail, isTournamentManager } from "@/lib/sheets/tournaments";
import { moveParticipantToHouse, removeParticipantFromHouse } from "@/lib/sheets/tournament-houses";

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
    const detail = await fetchTournamentDetail(id);
    if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isTournamentManager(detail.tournament, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await removeParticipantFromHouse(id, participantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Thread `type` through `src/app/api/tournaments/route.ts`'s create endpoint**

Change the `CreateSchema` from:

```ts
const CreateSchema = z.object({
  name: z.string().min(1),
  manager_email: z.email(),
  rules_url: z.string().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
});
```

to:

```ts
const CreateSchema = z.object({
  name: z.string().min(1),
  manager_email: z.email(),
  rules_url: z.string().optional(),
  handicap_points_per_rating_gap: z.number().int().positive().optional(),
  type: z.enum(["regular", "multi_location"]).optional(),
});
```

The rest of the route is unchanged — `createTournament(body)` already forwards every field of `body` through, and `body.type` now flows straight into the `type` param added to `createTournament` in Task 2.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/tournaments/[id]/locations" "src/app/api/tournaments/[id]/participants/[participantId]/location" "src/app/api/tournaments/[id]/houses/participants/[participantId]/route.ts" src/app/api/tournaments/route.ts
git commit -m "feat(tournaments): add location/house-assignment API routes"
```

---

### Task 6: Create-tournament dialog gets a type selector

**Files:**
- Modify: `src/app/(admin)/admin/tournaments/page.tsx`

- [ ] **Step 1: Add the type selector**

In `src/app/(admin)/admin/tournaments/page.tsx`:

Add `const [type, setType] = useState<"regular" | "multi_location">("regular");` alongside the other `useState` declarations at the top of the component.

In `createMut`'s `mutationFn`, add `type,` to the JSON body:

```ts
        body: JSON.stringify({
          name: name.trim(),
          manager_email: managerEmail,
          rules_url: rulesUrl.trim() || undefined,
          handicap_points_per_rating_gap: Number(handicapGap) || undefined,
          type,
        }),
```

In `createMut`'s `onSuccess`, add `setType("regular");` alongside the other field resets:

```ts
    onSuccess: ({ tournament }) => {
      toast.success("הטורניר נוצר");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      setOpen(false);
      setName("");
      setManagerEmail("");
      setRulesUrl("");
      setHandicapGap("20");
      setType("regular");
      router.push(`/admin/tournaments/${tournament.id}`);
    },
```

In the dialog body, add a new field directly after the "מאמן אחראי" `<Select>` block and before the "קישור לתקנון" field:

```tsx
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">סוג טורניר</Label>
                  <Select value={type} onValueChange={(v) => v && setType(v as "regular" | "multi_location")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">רגיל</SelectItem>
                      <SelectItem value="multi_location">רב-מיקומי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/tournaments/page.tsx"
git commit -m "feat(tournaments): add tournament type selector to the create dialog"
```

---

### Task 7: `TournamentLocationsView`

**Files:**
- Create: `src/components/tournament-locations-view.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { computeHouseStandings, formatHandicapLabel } from "@/lib/sheets/tournament-logic";

type Participant = {
  id: string;
  location_id: string | null;
  house_id: string | null;
  student: { first_name: string; last_name: string; rating: number };
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

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
  location_id: string | null;
  matches: HouseMatch[];
  memberIds: string[];
};

export function TournamentLocationsView({
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
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [newHouseLabels, setNewHouseLabels] = useState<Record<string, string>>({});

  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ["tournament-locations", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { locations: TournamentLocation[] };
    },
  });

  const { data: housesData, isLoading: housesLoading } = useQuery({
    queryKey: ["tournament-houses", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { houses: HouseWithMatches[]; hasAnyResult: boolean };
    },
  });

  const addLocationMut = useMutation({
    mutationFn: async (label: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המיקום נוסף");
      setNewLocationLabel("");
      qc.invalidateQueries({ queryKey: ["tournament-locations", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת מיקום"),
  });

  const addHouseMut = useMutation({
    mutationFn: async ({ locationId, label }: { locationId: string; label: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations/${locationId}/houses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: (_data, { locationId }) => {
      toast.success("הבית נוסף");
      setNewHouseLabels((prev) => ({ ...prev, [locationId]: "" }));
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
    },
    onError: () => toast.error("שגיאה בהוספת בית"),
  });

  const assignHouseMut = useMutation({
    mutationFn: async ({ participantId, houseId }: { participantId: string; houseId: string }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("השחקן שובץ לבית");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיבוץ לבית"),
  });

  const removeFromHouseMut = useMutation({
    mutationFn: async (participantId: string) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/houses/participants/${participantId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("השחקן הוסר מהבית");
      qc.invalidateQueries({ queryKey: ["tournament-houses", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בהסרה מהבית"),
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

  function participantName(id: string) {
    const p = participants.find((x) => x.id === id);
    return p ? [p.student.first_name, p.student.last_name].filter(Boolean).join(" ") : "?";
  }
  function participantRating(id: string) {
    return participants.find((x) => x.id === id)?.student.rating ?? 1000;
  }

  if (locationsLoading || housesLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  const locations = locationsData?.locations ?? [];
  const houses = housesData?.houses ?? [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">מיקום חדש</label>
            <Input value={newLocationLabel} onChange={(e) => setNewLocationLabel(e.target.value)} placeholder="למשל: אולם צפון" dir="auto" />
          </div>
          <Button onClick={() => addLocationMut.mutate(newLocationLabel.trim())} disabled={!newLocationLabel.trim() || addLocationMut.isPending}>
            <Plus size={14} className="ml-1.5" />
            הוסף מיקום
          </Button>
        </div>
      )}

      {locations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/60 bg-card">
          עדיין אין מיקומים
        </div>
      ) : (
        locations.map((location) => {
          const locationHouses = houses.filter((h) => h.location_id === location.id);
          const unassigned = participants.filter((p) => p.location_id === location.id && !p.house_id);
          return (
            <div key={location.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <p className="text-sm font-semibold px-4 pt-3 pb-2">{location.label}</p>

              {canEdit && (
                <div className="flex items-end gap-2 px-4 pb-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">בית חדש</label>
                    <Input
                      value={newHouseLabels[location.id] ?? ""}
                      onChange={(e) => setNewHouseLabels((prev) => ({ ...prev, [location.id]: e.target.value }))}
                      placeholder="למשל: בית מתקדמים"
                      dir="auto"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addHouseMut.mutate({ locationId: location.id, label: (newHouseLabels[location.id] ?? "").trim() })}
                    disabled={!(newHouseLabels[location.id] ?? "").trim() || addHouseMut.isPending}
                  >
                    <Plus size={14} className="ml-1.5" />
                    הוסף בית
                  </Button>
                </div>
              )}

              {unassigned.length > 0 && (
                <div className="flex flex-col gap-2 px-4 pb-3 border-t border-border/40 pt-3">
                  <p className="text-xs font-medium text-muted-foreground">לא משוייכים לבית</p>
                  {unassigned.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">
                        {[p.student.first_name, p.student.last_name].filter(Boolean).join(" ")}
                      </span>
                      {canEdit && locationHouses.length > 0 && (
                        <Select onValueChange={(v) => v && assignHouseMut.mutate({ participantId: p.id, houseId: v })}>
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue placeholder="בחר בית..." />
                          </SelectTrigger>
                          <SelectContent>
                            {locationHouses.map((h) => (
                              <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {locationHouses.map((house) => {
                const standings = computeHouseStandings(house.memberIds, house.matches);
                return (
                  <div key={house.id} className="border-t border-border/40">
                    <p className="text-sm font-semibold px-4 pt-3 pb-2">{house.label}</p>
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
                              <td className="px-2 py-1.5">
                                {participantName(row.participantId)}
                                {canEdit && (
                                  <Select
                                    value={house.id}
                                    onValueChange={(v) => {
                                      if (!v || v === house.id) return;
                                      if (v === "none") removeFromHouseMut.mutate(row.participantId);
                                      else assignHouseMut.mutate({ participantId: row.participantId, houseId: v });
                                    }}
                                  >
                                    <SelectTrigger className="h-6 w-24 text-[10px] mr-2 inline-flex">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {locationHouses.map((h) => (
                                        <SelectItem key={h.id} value={h.id}>{h.label}</SelectItem>
                                      ))}
                                      <SelectItem value="none">הסר משיבוץ</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </td>
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
                          <LocationMatchRow
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
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

function LocationMatchRow({
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

  function save() {
    const a = framesA.trim();
    const b = framesB.trim();
    const na = Number(a);
    const nb = Number(b);
    // Number("") and Number(" ") both coerce to 0 — trim + explicit
    // emptiness + Number.isInteger together are required to reject a
    // whitespace-only input instead of silently recording a 0 result.
    if (a === "" || b === "" || !Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0) {
      toast.error("יש להזין תוצאה תקינה");
      return;
    }
    onSave(na, nb);
  }

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
              disabled={saving || framesA.trim() === "" || framesB.trim() === ""}
              onClick={save}
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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this also resolves the expected Task 7 error about the missing module).

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all tests pass (no new tests in this task — this is a UI component, matching the untested-by-design precedent for `tournament-houses-view.tsx`/`league-districts-view.tsx`).

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-locations-view.tsx
git commit -m "feat(tournaments): add TournamentLocationsView"
```

---

### Task 8: `tournament-detail-view.tsx` — location assignment

**Files:**
- Modify: `src/components/tournament-detail-view.tsx`

- [ ] **Step 1: Replace the full file contents**

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TournamentParticipantPicker } from "@/components/tournament-participant-picker";
import { TournamentHousesView } from "@/components/tournament-houses-view";
import { TournamentLocationsView } from "@/components/tournament-locations-view";
import { TournamentKnockoutView } from "@/components/tournament-knockout-view";

type TournamentParticipant = {
  id: string;
  tournament_id: string;
  student_id: string;
  paid: boolean;
  location_id: string | null;
  house_id: string | null;
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
  type: "regular" | "multi_location";
  created_at: string;
};

type TournamentLocation = { id: string; tournament_id: string; label: string };

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

  const { data: locationsData } = useQuery({
    queryKey: ["tournament-locations", tournamentId],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments/${tournamentId}/locations`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { locations: TournamentLocation[] };
    },
    enabled: data?.tournament.type === "multi_location",
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

  const assignLocationMut = useMutation({
    mutationFn: async ({ participantId, locationId }: { participantId: string; locationId: string | null }) => {
      const r = await fetch(`/api/tournaments/${tournamentId}/participants/${participantId}/location`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast.success("שויך למיקום");
      qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "שגיאה בשיוך למיקום"),
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
  const locations = locationsData?.locations ?? [];
  const canEdit = isAdmin || tournament.manager_email.trim().toLowerCase() === currentEmail.trim().toLowerCase();
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
                  {tournament.type === "multi_location" && (
                    p.house_id ? (
                      <span className="text-xs text-muted-foreground" title="יש להסיר מהבית לפני שינוי מיקום">
                        {locations.find((l) => l.id === p.location_id)?.label ?? "ללא מיקום"}
                      </span>
                    ) : (
                      <Select
                        value={p.location_id ?? "none"}
                        onValueChange={(v) => v && assignLocationMut.mutate({ participantId: p.id, locationId: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="ללא מיקום" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ללא מיקום</SelectItem>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  )}
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

        {participants.length > 0 && tournament.type === "regular" && (
          <TournamentHousesView
            tournamentId={tournamentId}
            participants={participants}
            handicapPointsPerRatingGap={tournament.handicap_points_per_rating_gap}
            canEdit={canEdit}
          />
        )}

        {participants.length > 0 && tournament.type === "multi_location" && (
          <TournamentLocationsView
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

Note: `TournamentHousesView`, `TournamentKnockoutView`, and `TournamentParticipantPicker` all currently declare their own local `Participant`/`TournamentParticipant` type with a narrower field set (no `location_id`/`house_id`). Passing the now-wider `participants` array to them is safe — TypeScript structurally allows an object with extra fields to satisfy a narrower type — so none of those three files need any change.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors — `TournamentLocationsView` already exists from Task 7.

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/tournament-detail-view.tsx
git commit -m "feat(tournaments): add location assignment to the participants list"
```

---

### Task 9: Final verification and push

- [ ] **Step 1: Full-repo typecheck and test run**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run test:run`
Expected: all tests pass.

- [ ] **Step 2: Push**

```bash
git push origin main
```
