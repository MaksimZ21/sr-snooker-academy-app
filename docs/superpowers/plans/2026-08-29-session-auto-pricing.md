# Session Auto-Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically set a session's `source` and `price_nis` by matching admin-managed keyword rules against the session's name (CRM-created sessions only), with a manual price override in the edit-session dialog that's permanently protected from being overwritten by the automatic rule.

**Architecture:** A new admin-managed `session_pricing_rules` table (keyword → price) drives a pure matching function, reused both by the CRM session-upsert path (automatic) and, later on request, by a one-off backfill Claude runs directly (not part of this plan — see spec). A new `sessions.price_manual` flag, set whenever an admin edits price by hand, is checked before the automatic rule is ever allowed to touch a session's `source`/`price_nis` again.

**Tech Stack:** Next.js API routes, Supabase, zod, TanStack Query, sonner, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-session-auto-pricing-design.md`

---

### Task 1: Migration — pricing rules table + manual-price flag

**Files:**
- Create: `supabase/migrations/20260829_session_pricing_rules.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Session auto-pricing: admin-managed keyword -> price rules, matched
-- against a session's name to automatically set its source and price_nis.
--
-- session_pricing_rules: each row is a keyword to match (case-insensitively)
-- against a session's name; on a match, its label becomes the session's
-- source and its price_nis becomes the session's price.
-- sessions.price_manual: true once an admin manually edits a session's
-- price — the automatic rule never overwrites a session once this is set.

CREATE TABLE session_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  price_nis INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS price_manual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE session_pricing_rules ENABLE ROW LEVEL SECURITY;

INSERT INTO session_pricing_rules (label, price_nis) VALUES
  ('מכללה', 150),
  ('אירוע הכרות', 150);
```

- [ ] **Step 2: Report the migration for manual application**

This project has no migration runner — the user applies `.sql` files manually via the Supabase SQL Editor (see `CLAUDE.md`). Do not attempt to run this yourself. End this task's report with: "יש להריץ ידנית ב-Supabase SQL Editor: `supabase/migrations/20260829_session_pricing_rules.sql`".

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260829_session_pricing_rules.sql
git commit -m "feat: add session_pricing_rules table and sessions.price_manual column"
```

---

### Task 2: Add `price_manual` to the `Session` type

**Files:**
- Modify: `src/lib/sheets/schemas.ts`

- [ ] **Step 1: Extend `SessionRow`**

Change:

```ts
  status: z.enum(["scheduled", "completed", "cancelled"]),
  price_nis: z.coerce.number().int().nullable().default(null),
  source: z.string().default(""),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
export type Session = z.infer<typeof SessionRow>;
```

to:

```ts
  status: z.enum(["scheduled", "completed", "cancelled"]),
  price_nis: z.coerce.number().int().nullable().default(null),
  source: z.string().default(""),
  price_manual: z.boolean().default(false),
  payment_status: z.enum(["pending", "paid"]).catch("pending"),
});
export type Session = z.infer<typeof SessionRow>;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this file is read via `select("*")` casts elsewhere, not `.parse()`, so widening the type is safe and non-breaking).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/schemas.ts
git commit -m "feat: add price_manual to the Session type"
```

---

### Task 3: Pure matching logic (client-safe) + tests

**Files:**
- Create: `src/lib/sheets/session-pricing-shared.ts`
- Create: `src/lib/sheets/session-pricing-shared.test.ts`

This file must have **no import of `@/lib/db/client`** — it will be imported by a client component later in this plan, and this codebase has a known bug class where importing a `db`-touching module into a `"use client"` component crashes the browser with "supabaseKey is required." (see the git history around commit `f9f8a75` for the exact failure mode). Keeping the pure matching logic in its own file with zero `db` dependency avoids that entirely, and makes it trivially unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveSessionPricing, type SessionPricingRule } from "./session-pricing-shared";

const rules: SessionPricingRule[] = [
  { id: "1", label: "מכללה", price_nis: 150 },
  { id: "2", label: "אירוע הכרות", price_nis: 150 },
];

describe("resolveSessionPricing", () => {
  it("matches a rule whose label appears in the session name", () => {
    expect(resolveSessionPricing("מכללת תל אביב", rules)).toEqual({ source: "מכללה", price_nis: 150 });
  });

  it("matches case-insensitively", () => {
    const en: SessionPricingRule[] = [{ id: "1", label: "College", price_nis: 150 }];
    expect(resolveSessionPricing("COLLEGE session", en)).toEqual({ source: "College", price_nis: 150 });
  });

  it("returns null when no rule matches", () => {
    expect(resolveSessionPricing("שיעור פרטי", rules)).toBeNull();
  });

  it("returns the first matching rule when multiple could match", () => {
    expect(resolveSessionPricing("מכללה - אירוע הכרות", rules)).toEqual({ source: "מכללה", price_nis: 150 });
  });

  it("returns null for an empty name", () => {
    expect(resolveSessionPricing("", rules)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/sheets/session-pricing-shared.test.ts`
Expected: FAIL — `session-pricing-shared.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
export type SessionPricingRule = {
  id: string;
  label: string;
  price_nis: number;
};

// Finds the first rule whose label appears (case-insensitively) anywhere
// in the session name, and returns the source/price it implies — or null
// if no rule matches. Pure function, no DB access.
export function resolveSessionPricing(
  name: string,
  rules: SessionPricingRule[],
): { source: string; price_nis: number } | null {
  const haystack = name.toLowerCase();
  const match = rules.find((r) => haystack.includes(r.label.toLowerCase()));
  return match ? { source: match.label, price_nis: match.price_nis } : null;
}
```

- [ ] **Step 4: Run the test again to confirm it passes**

Run: `npx vitest run src/lib/sheets/session-pricing-shared.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/session-pricing-shared.ts src/lib/sheets/session-pricing-shared.test.ts
git commit -m "feat: add resolveSessionPricing pure matching logic with tests"
```

---

### Task 4: Data-layer functions for the rules table

**Files:**
- Create: `src/lib/sheets/session-pricing.ts`

- [ ] **Step 1: Write the file**

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { SessionPricingRule } from "./session-pricing-shared";

// Server-only data access for session_pricing_rules. Never import this
// file from a "use client" component — it eagerly constructs the
// service-role Supabase client. Client components needing the
// SessionPricingRule type or resolveSessionPricing should import from
// "./session-pricing-shared" instead.
export type { SessionPricingRule } from "./session-pricing-shared";
export { resolveSessionPricing } from "./session-pricing-shared";

export const fetchSessionPricingRules = unstable_cache(
  async (): Promise<SessionPricingRule[]> => {
    const { data } = await db
      .from("session_pricing_rules")
      .select("id, label, price_nis")
      .order("created_at");
    return (data ?? []) as SessionPricingRule[];
  },
  ["session-pricing-rules:all"],
  { revalidate: 300, tags: ["session-pricing-rules"] },
);

export async function appendSessionPricingRule(input: {
  label: string;
  price_nis: number;
}): Promise<void> {
  await db.from("session_pricing_rules").insert({
    label: input.label,
    price_nis: input.price_nis,
  });
  revalidateTag("session-pricing-rules", { expire: 0 });
}

export async function deleteSessionPricingRule(id: string): Promise<void> {
  await db.from("session_pricing_rules").delete().eq("id", id);
  revalidateTag("session-pricing-rules", { expire: 0 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This will report an error about the not-yet-existing `session_pricing_rules` table in Supabase's generated types if this project uses generated DB types — it does not; `db` is untyped (`SupabaseClient` without a generic), so this compiles regardless of whether the migration has actually been applied yet.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/session-pricing.ts
git commit -m "feat: add session pricing rules data-layer functions"
```

---

### Task 5: API routes for the rules table

**Files:**
- Create: `src/app/api/session-pricing/route.ts`
- Create: `src/app/api/session-pricing/[id]/route.ts`

- [ ] **Step 1: Write `src/app/api/session-pricing/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { appendSessionPricingRule, fetchSessionPricingRules } from "@/lib/sheets/session-pricing";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const rules = await fetchSessionPricingRules();
    return NextResponse.json({ rules });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        label: z.string().min(1),
        price_nis: z.coerce.number().int().nonnegative(),
      })
      .parse(await req.json());
    await appendSessionPricingRule(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

Note this is admin-only for **both** GET and POST — unlike the existing `/api/pricing` route (whose GET is open to any authenticated user, since that's a public-facing rate card coaches need to see). This new rules table is internal financial configuration with no coach-facing view, per the spec.

- [ ] **Step 2: Write `src/app/api/session-pricing/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { deleteSessionPricingRule } from "@/lib/sheets/session-pricing";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    await deleteSessionPricingRule(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/session-pricing/route.ts" "src/app/api/session-pricing/[id]/route.ts"
git commit -m "feat: add admin API routes for session pricing rules"
```

---

### Task 6: Admin UI for managing rules

**Files:**
- Create: `src/components/forms/add-session-pricing-rule-dialog.tsx`
- Create: `src/components/session-pricing-table.tsx`

- [ ] **Step 1: Write `src/components/forms/add-session-pricing-rule-dialog.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddSessionPricingRuleDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const qc = useQueryClient();

  const reset = () => {
    setLabel("");
    setPrice("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/session-pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          price_nis: Number(price),
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { ok: true };
    },
    onSuccess: () => {
      toast.success("הכלל נוסף");
      qc.invalidateQueries({ queryKey: ["session-pricing"] });
      setOpen(false);
      reset();
    },
    onError: () => toast.error("שגיאה בהוספת הכלל"),
  });

  const canSubmit =
    label.trim().length > 0 &&
    price.trim().length > 0 &&
    !Number.isNaN(Number(price)) &&
    !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף כלל
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוסף כלל תמחור</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>מילת מפתח (בשם האימון)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='לדוג׳: "מכללה"' />
          </div>
          <div>
            <Label>מחיר (₪)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={mut.isPending}>
            ביטול
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write `src/components/session-pricing-table.tsx`**

```tsx
"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionPricingRule } from "@/lib/sheets/session-pricing-shared";
import { AddSessionPricingRuleDialog } from "@/components/forms/add-session-pricing-rule-dialog";

export function SessionPricingTable() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["session-pricing"],
    queryFn: async () => {
      const r = await fetch("/api/session-pricing");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { rules: SessionPricingRule[] };
    },
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/session-pricing/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("הכלל נמחק");
      qc.invalidateQueries({ queryKey: ["session-pricing"] });
    },
    onError: () => toast.error("שגיאה במחיקת הכלל"),
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }
  const rows = data?.rules ?? [];

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex justify-end">
        <AddSessionPricingRuleDialog />
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-right p-2">מילת מפתח</th>
            <th className="text-right p-2">מחיר (₪)</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-sm text-muted-foreground">
                אין עדיין כללים
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.label}</td>
                <td className="p-2">{r.price_nis}</td>
                <td className="p-2 text-left">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(r.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/add-session-pricing-rule-dialog.tsx src/components/session-pricing-table.tsx
git commit -m "feat: add session pricing rules admin UI components"
```

---

### Task 7: Admin page + navigation

**Files:**
- Create: `src/app/(admin)/admin/session-pricing/page.tsx`
- Modify: `src/components/nav-items.ts`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SessionPricingTable } from "@/components/session-pricing-table";

export default function Page() {
  return (
    <div className="flex flex-col">
      <PageHeader icon={<Sparkles size={20} />} title="תמחור אימונים" subtitle="כללי תמחור אוטומטי לפי שם האימון" />
      <SessionPricingTable />
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item (admin only — not `COACH_NAV`)**

In `src/components/nav-items.ts`, change:

```ts
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

to:

```ts
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/session-pricing", label: "תמחור אימונים", icon: "Sparkles" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

- [ ] **Step 3: Register the icon**

In `src/components/app-shell.tsx`, change:

```tsx
import {
  LogOut, Sun, Moon, LayoutGrid, X,
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Tag, Target, Trophy, User, Users, UsersRound,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  Activity, Banknote, Calendar, ClipboardList, FolderOpen,
  GraduationCap, History, Home, MessageCircle, MessageSquare,
  Tag, Target, Trophy, User, Users, UsersRound,
};
```

to:

```tsx
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

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/session-pricing/page.tsx" src/components/nav-items.ts src/components/app-shell.tsx
git commit -m "feat: add session pricing admin page and nav entry"
```

---

### Task 8: Apply the rule automatically in the CRM session-upsert path

**Files:**
- Modify: `src/lib/sheets/sessions.ts`

- [ ] **Step 1: Import the pricing helpers**

Change:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { Session } from "./schemas";
```

to:

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { fetchSessionPricingRules, resolveSessionPricing } from "./session-pricing";
import type { Session } from "./schemas";
```

- [ ] **Step 2: Track `price_manual` when resolving the existing session**

In `upsertSessionFromCrm`, change:

```ts
  let existing: { id: string } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  } else {
    const { data } = await db
      .from("sessions")
      .select("id")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string } | null;
  }
```

to:

```ts
  let existing: { id: string; price_manual: boolean } | null = null;
  if (input.crm_appointment_id) {
    const { data } = await db
      .from("sessions")
      .select("id, price_manual")
      .eq("crm_appointment_id", input.crm_appointment_id)
      .maybeSingle();
    existing = data as { id: string; price_manual: boolean } | null;
  } else {
    const { data } = await db
      .from("sessions")
      .select("id, price_manual")
      .eq("crm_event_id", input.crm_event_id)
      .maybeSingle();
    existing = data as { id: string; price_manual: boolean } | null;
  }
```

- [ ] **Step 3: Resolve a pricing match after `fields` is built**

Change:

```ts
  const fields = {
    name: input.name ?? "",
    date: input.date,
    start_time: input.start_time,
    end_time: endTime,
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
    group_id: resolvedGroupId,
  };

  if (existing) {
    const updateData = {
      ...fields,
      ...(studentIds.length > 0 && { student_ids: studentIds }),
      ...(resolvedCoachEmail && { coach_email: resolvedCoachEmail }),
    };
    await db.from("sessions").update(updateData).eq("id", existing.id);
    invalidateSessions();
    return { id: existing.id as string, action: "updated" };
  }
```

to:

```ts
  const fields = {
    name: input.name ?? "",
    date: input.date,
    start_time: input.start_time,
    end_time: endTime,
    training_type: input.training_type ?? "group",
    address: input.address ?? "",
    crm_event_id: input.crm_event_id,
    crm_event_type: input.crm_event_type ?? "",
    crm_appointment_id: input.crm_appointment_id ?? "",
    group_id: resolvedGroupId,
  };

  // Automatically price/tag the session by matching its name against the
  // admin-managed rules — but never for a session an admin has already
  // priced by hand (price_manual: true survives every future CRM sync).
  const pricingRules = await fetchSessionPricingRules();
  const pricingMatch = resolveSessionPricing(fields.name, pricingRules);

  if (existing) {
    const updateData = {
      ...fields,
      ...(studentIds.length > 0 && { student_ids: studentIds }),
      ...(resolvedCoachEmail && { coach_email: resolvedCoachEmail }),
      ...(pricingMatch && !existing.price_manual && {
        source: pricingMatch.source,
        price_nis: pricingMatch.price_nis,
      }),
    };
    await db.from("sessions").update(updateData).eq("id", existing.id);
    invalidateSessions();
    return { id: existing.id as string, action: "updated" };
  }
```

- [ ] **Step 4: Apply the match on the create (insert) path too**

Change:

```ts
  await db.from("sessions").insert({
    id,
    ...fields,
    coach_email: resolvedCoachEmail,
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
  });
  invalidateSessions();
  return { id, action: "created" };
}
```

to:

```ts
  await db.from("sessions").insert({
    id,
    ...fields,
    coach_email: resolvedCoachEmail,
    student_ids: studentIds,
    drive_folder_url: "",
    status: "scheduled",
    ...(pricingMatch && { source: pricingMatch.source, price_nis: pricingMatch.price_nis }),
  });
  invalidateSessions();
  return { id, action: "created" };
}
```

Do **not** change the "attach to a manually-created session" branch (the block starting `if (resolvedGroupId) { const { data: manualMatches } = ...`, a few lines below this insert) — it deliberately only touches CRM-linkage fields and leaves everything else (including price) exactly as the admin entered it manually. That's correct as-is; leave it untouched.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test:run`
Expected: all existing tests still pass, plus the new `session-pricing-shared.test.ts` (5 tests) from Task 3.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheets/sessions.ts
git commit -m "feat: auto-price CRM-created sessions from pricing rules"
```

---

### Task 9: Manual price override, protected from being overwritten

**Files:**
- Modify: `src/lib/sheets/sessions.ts`
- Modify: `src/app/api/sessions/[id]/route.ts`
- Modify: `src/components/forms/edit-session-dialog.tsx`

- [ ] **Step 1: Extend `updateSession` to accept and lock in a manual price**

In `src/lib/sheets/sessions.ts`, change:

```ts
export async function updateSession(
  id: string,
  input: {
    date?: string;
    start_time?: string;
    end_time?: string;
    coach_email?: string;
    training_type?: string;
    status?: string;
  },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.start_time !== undefined) patch.start_time = input.start_time;
  if (input.end_time !== undefined) patch.end_time = input.end_time;
  if (input.coach_email !== undefined) patch.coach_email = input.coach_email.trim().toLowerCase();
  if (input.training_type !== undefined) patch.training_type = input.training_type;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return;
  await db.from("sessions").update(patch).eq("id", id);
  invalidateSessions();
}
```

to:

```ts
export async function updateSession(
  id: string,
  input: {
    date?: string;
    start_time?: string;
    end_time?: string;
    coach_email?: string;
    training_type?: string;
    status?: string;
    price_nis?: number;
  },
): Promise<void> {
  const patch: Record<string, string | number | boolean> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.start_time !== undefined) patch.start_time = input.start_time;
  if (input.end_time !== undefined) patch.end_time = input.end_time;
  if (input.coach_email !== undefined) patch.coach_email = input.coach_email.trim().toLowerCase();
  if (input.training_type !== undefined) patch.training_type = input.training_type;
  if (input.status !== undefined) patch.status = input.status;
  if (input.price_nis !== undefined) {
    // A manually-entered price is locked in — price_manual survives every
    // future automatic CRM sync (see upsertSessionFromCrm), so this
    // session's price is never silently overwritten again.
    patch.price_nis = input.price_nis;
    patch.price_manual = true;
  }
  if (Object.keys(patch).length === 0) return;
  await db.from("sessions").update(patch).eq("id", id);
  invalidateSessions();
}
```

- [ ] **Step 2: Accept `price_nis` in the PATCH route**

In `src/app/api/sessions/[id]/route.ts`, change:

```ts
const PatchBody = z.object({
  date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  coach_email: z.string().optional(),
  training_type: z.string().optional(),
  status: z.string().optional(),
});
```

to:

```ts
const PatchBody = z.object({
  date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  coach_email: z.string().optional(),
  training_type: z.string().optional(),
  status: z.string().optional(),
  price_nis: z.coerce.number().int().nonnegative().optional(),
});
```

- [ ] **Step 3: Add the price field to the edit-session dialog**

In `src/components/forms/edit-session-dialog.tsx`, change:

```tsx
  const [coachEmail, setCoachEmail] = useState(session.coach_email);
  const [trainingType, setTrainingType] = useState<string>(session.training_type);
  const [status, setStatus] = useState(session.status);
  const qc = useQueryClient();
```

to:

```tsx
  const [coachEmail, setCoachEmail] = useState(session.coach_email);
  const [trainingType, setTrainingType] = useState<string>(session.training_type);
  const [status, setStatus] = useState(session.status);
  const [price, setPrice] = useState(session.price_nis != null ? String(session.price_nis) : "");
  const qc = useQueryClient();
```

Change:

```tsx
  function onOpenChange(v: boolean) {
    if (v) {
      setDate(session.date);
      const [sh, sm] = splitTime(session.start_time);
      const [eh, em] = splitTime(session.end_time);
      setStartH(sh); setStartM(sm);
      setEndH(eh); setEndM(em);
      setCoachEmail(session.coach_email);
      setTrainingType(session.training_type);
      setStatus(session.status);
    }
    setOpen(v);
  }
```

to:

```tsx
  function onOpenChange(v: boolean) {
    if (v) {
      setDate(session.date);
      const [sh, sm] = splitTime(session.start_time);
      const [eh, em] = splitTime(session.end_time);
      setStartH(sh); setStartM(sm);
      setEndH(eh); setEndM(em);
      setCoachEmail(session.coach_email);
      setTrainingType(session.training_type);
      setStatus(session.status);
      setPrice(session.price_nis != null ? String(session.price_nis) : "");
    }
    setOpen(v);
  }
```

Change:

```tsx
  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, start_time: startTime, end_time: endTime, coach_email: coachEmail, training_type: trainingType, status }),
      });
      if (!r.ok) throw new Error("failed");
    },
```

to:

```tsx
  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date, start_time: startTime, end_time: endTime, coach_email: coachEmail, training_type: trainingType, status,
          ...(price.trim() !== "" && { price_nis: Number(price) }),
        }),
      });
      if (!r.ok) throw new Error("failed");
    },
```

Change:

```tsx
          <div>
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "scheduled")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">פעיל</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
```

to:

```tsx
          <div>
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "scheduled")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">פעיל</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>מחיר (₪)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="אוטומטי אם ריק"
            />
          </div>
        </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/sessions.ts "src/app/api/sessions/[id]/route.ts" src/components/forms/edit-session-dialog.tsx
git commit -m "feat: add manual session price override, locked against future auto-pricing"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Full test run**

Run: `npm run test:run`
Expected: all existing tests plus the 5 new `resolveSessionPricing` tests pass.

- [ ] **Step 3: Manual sanity check**

In the running app (`npm run dev`), after the migration from Task 1 has been applied to the database:
- Open `/admin/session-pricing` — confirm the two seeded rules ("מכללה" → 150, "אירוע הכרות" → 150) are listed, and that adding/deleting a rule works.
- Trigger (or simulate via curl) a CRM `event_created` webhook call whose `meeting_title`/`meeting_type` contains "מכללה" — confirm the resulting session has `source: "מכללה"` and `price_nis: 150`.
- Open that session in the admin schedule and use the edit-session dialog to manually set a different price — save, then confirm the price stuck. Trigger the same CRM webhook event again (an update) and confirm the manually-set price was **not** overwritten.
- Confirm a coach account cannot reach `/admin/session-pricing` or `GET /api/session-pricing` (should 403/redirect).

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Report to the user (in Hebrew)**

Summarize what shipped, and explicitly remind the user: (a) the migration from Task 1 needs to be run manually in the Supabase SQL Editor if it hasn't been already, and (b) once they've reviewed/adjusted the rules on `/admin/session-pricing`, they can ask Claude to run the one-time backfill over existing sessions (per the spec — this is a one-off action Claude performs directly, not a button in the product).
