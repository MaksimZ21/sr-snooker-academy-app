# Tournaments Phase 5 — Admin Players List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/admin/players` page listing every `students` row that has ever played a tournament (`public_slug IS NOT NULL`) — real students and tournament-only customers alike — with rating, tournament count, a copyable public-profile link, and an admin-editable rating override.

**Architecture:** Pure read/write against the existing `students` and `tournament_participants` tables — no migration needed (`rating` and `public_slug` already exist on `students` from earlier tournament phases). One new data-layer module (`players.ts`) shapes the list; rating edits reuse the existing `updateStudent` function, extended with one new optional field.

**Scope note:** Per the original master spec (`docs/superpowers/specs/2026-08-11-tournaments-design.md`, "Admin UI: Players List"), this page was also meant to show a loyalty-tier ("דרגת נאמנות") assignment control. That entire loyalty program (`docs/superpowers/specs/2026-08-24-loyalty-program-design.md`) was only ever specced, never built — no `loyalty_tiers` table, no `loyalty_tier_id` column, nothing in the codebase. Confirmed with the user (2026-09-12): build this page without that column. If the loyalty program is built later, adding its control here is a small follow-up, not a redesign.

**Tech Stack:** Next.js API routes, Supabase (service-role `db` client), TanStack Query, shadcn/ui.

---

### Task 1: Data layer — `players.ts` + `updateStudent` rating support

**Files:**
- Create: `src/lib/sheets/players.ts`
- Modify: `src/lib/sheets/students.ts:109-127` (the `updateStudent` function)

- [ ] **Step 1: Extend `updateStudent` to accept a rating**

In `src/lib/sheets/students.ts`, find:

```ts
export async function updateStudent(
  id: string,
  input: {
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
  },
): Promise<void> {
```

Change the `input` type to add one field, `rating?: number`, right after `active?: boolean;`:

```ts
export async function updateStudent(
  id: string,
  input: {
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
    rating?: number;
  },
): Promise<void> {
```

Nothing else in that function changes — `db.from("students").update(input).eq("id", id)` already applies whatever fields are present in `input`.

- [ ] **Step 2: Write `src/lib/sheets/players.ts`**

```ts
import { db } from "@/lib/db/client";
import { studentFullName } from "@/lib/sheets/schemas";

export type Player = {
  id: string;
  name: string;
  phone: string;
  rating: number;
  tournamentsPlayed: number;
  publicSlug: string;
};

export async function fetchPlayers(): Promise<Player[]> {
  const { data: studentRows } = await db
    .from("students")
    .select("id, first_name, last_name, phone, rating, public_slug")
    .not("public_slug", "is", null);
  const students = (studentRows ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    rating: number;
    public_slug: string;
  }[];

  const studentIds = students.map((s) => s.id);
  const { data: participantRows } = studentIds.length
    ? await db.from("tournament_participants").select("student_id").in("student_id", studentIds)
    : { data: [] as { student_id: string }[] };

  const countByStudentId = new Map<string, number>();
  for (const row of participantRows ?? []) {
    const id = row.student_id as string;
    countByStudentId.set(id, (countByStudentId.get(id) ?? 0) + 1);
  }

  return students
    .map((s) => ({
      id: s.id,
      name: studentFullName(s),
      phone: s.phone ?? "",
      rating: s.rating,
      tournamentsPlayed: countByStudentId.get(s.id) ?? 0,
      publicSlug: s.public_slug,
    }))
    .sort((a, b) => b.rating - a.rating);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/players.ts src/lib/sheets/students.ts
git commit -m "feat(players): add fetchPlayers data layer, rating on updateStudent"
```

---

### Task 2: API routes

**Files:**
- Create: `src/app/api/admin/players/route.ts`
- Create: `src/app/api/admin/players/[id]/route.ts`

- [ ] **Step 1: Write the list route**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchPlayers } from "@/lib/sheets/players";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const players = await fetchPlayers();
    return NextResponse.json({ players });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the rating-update route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { updateStudent } from "@/lib/sheets/students";

const PatchBody = z.object({
  rating: z.coerce.number().int(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = PatchBody.parse(await req.json());
    await updateStudent(id, { rating: body.rating });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `z` isn't already imported this way elsewhere, check `src/app/api/session-pricing/route.ts` for the exact same `zod` usage pattern already established in this codebase — match it, don't invent a different validation style.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/players
git commit -m "feat(players): add GET/PATCH admin players API routes"
```

---

### Task 3: `PlayersTable` component

**Files:**
- Create: `src/components/players-table.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Pencil, Check } from "lucide-react";
import type { Player } from "@/lib/sheets/players";

async function fetchPlayers(): Promise<Player[]> {
  const res = await fetch("/api/admin/players");
  if (!res.ok) throw new Error("fetch failed");
  const data = (await res.json()) as { players: Player[] };
  return data.players;
}

async function patchRating(id: string, rating: number): Promise<void> {
  const res = await fetch(`/api/admin/players/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error("update failed");
}

export function PlayersTable() {
  const qc = useQueryClient();

  const { data: players, isLoading, isError } = useQuery({
    queryKey: ["admin-players"],
    queryFn: fetchPlayers,
  });

  const { mutate: saveRating, isPending: saving } = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => patchRating(id, rating),
    onSuccess: () => {
      toast.success("הדירוג עודכן");
      qc.invalidateQueries({ queryKey: ["admin-players"] });
    },
    onError: () => toast.error("שגיאה בעדכון הדירוג"),
  });

  function copyLink(slug: string) {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("הקישור הועתק"))
      .catch(() => toast.error("שגיאה בהעתקת הקישור"));
  }

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        שגיאה בטעינת השחקנים
      </div>
    );
  }

  const rows = players ?? [];

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        עדיין אין שחקנים — שחקן מופיע כאן אחרי שהשתתף בטורניר אחד לפחות
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border/40">
                <th className="text-right px-4 py-2 font-medium">שם</th>
                <th className="text-right px-2 py-2 font-medium">טלפון</th>
                <th className="text-center px-2 py-2 font-medium">דירוג</th>
                <th className="text-center px-2 py-2 font-medium">טורנירים</th>
                <th className="text-center px-2 py-2 font-medium">פרופיל</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <PlayerRow
                  key={`${p.id}:${p.rating}`}
                  player={p}
                  onSaveRating={(rating) => saveRating({ id: p.id, rating })}
                  onCopyLink={() => copyLink(p.publicSlug)}
                  saving={saving}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  onSaveRating,
  onCopyLink,
  saving,
}: {
  player: Player;
  onSaveRating: (rating: number) => void;
  onCopyLink: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(player.rating));

  function save() {
    const n = Number(value);
    if (!Number.isInteger(n)) return;
    onSaveRating(n);
    setEditing(false);
  }

  return (
    <tr className="border-b border-border/20 last:border-b-0">
      <td className="px-4 py-2">{player.name}</td>
      <td className="px-2 py-2 text-muted-foreground">{player.phone || "—"}</td>
      <td className="px-2 py-2">
        {editing ? (
          <div className="flex items-center justify-center gap-1.5">
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-7 w-20 text-center px-1"
            />
            <Button size="sm" variant="outline" className="h-7 px-2" disabled={saving} onClick={save}>
              <Check size={13} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            <span className="tabular-nums font-medium">{player.rating}</span>
            <button
              type="button"
              onClick={() => {
                setValue(String(player.rating));
                setEditing(true);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="ערוך דירוג"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </td>
      <td className="text-center px-2 py-2 tabular-nums">{player.tournamentsPlayed}</td>
      <td className="text-center px-2 py-2">
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCopyLink}>
          <Link2 size={13} className="ml-1" />
          העתק
        </Button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/players-table.tsx
git commit -m "feat(players): add PlayersTable component"
```

---

### Task 4: Page + nav item

**Files:**
- Create: `src/app/(admin)/admin/players/page.tsx`
- Modify: `src/components/nav-items.ts`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { Award } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PlayersTable } from "@/components/players-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Award size={20} />} title="שחקנים" subtitle="כל השחקנים שהשתתפו בטורנירים" />
      <PlayersTable />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `src/components/nav-items.ts`, in `ADMIN_NAV`, add a new entry right after the `tournaments` item:

```ts
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/tournaments", label: "טורנירים", icon: "Trophy" },
  { href: "/admin/players", label: "שחקנים", icon: "Award" },
  { href: "/admin/messages", label: "פניות", icon: "MessageSquare" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { href: "/admin/webhook-logs", label: "לוגים CRM", icon: "Activity" },
  { href: "/admin/salary", label: "פיננסים", icon: "Banknote" },
  { href: "/admin/assessments", label: "דוחות אבחון", icon: "ClipboardList" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/session-pricing", label: "תמחור אימונים", icon: "Sparkles" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

(Only the `players` line is new — every other line stays exactly as-is; this is shown in full so the insertion point is unambiguous.)

- [ ] **Step 3: Register the `Award` icon in `app-shell.tsx`**

In `src/components/app-shell.tsx`, the import block currently reads:

```ts
import {
  LogOut, Sun, Moon, LayoutGrid, X,
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Sparkles, Tag, Target, Trophy, User, Users, UsersRound,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Sparkles, Tag, Target, Trophy, User, Users, UsersRound,
};
```

Change both to add `Award`:

```ts
import {
  LogOut, Sun, Moon, LayoutGrid, X,
  Activity, Award, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Sparkles, Tag, Target, Trophy, User, Users, UsersRound,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Activity, Award, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Sparkles, Tag, Target, Trophy, User, Users, UsersRound,
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (no pure-logic module touched by this task).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/players/page.tsx" src/components/nav-items.ts src/components/app-shell.tsx
git commit -m "feat(players): add /admin/players page and nav entry"
```

---

### Task 5: Final verification

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
