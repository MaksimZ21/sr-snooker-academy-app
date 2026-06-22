# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the top performance bottlenecks in the snooker academy app, ordered by severity — N+1 DB queries, Recharts bundle bloat, and missing route-level loading skeletons.

**Architecture:** All fixes are isolated and non-breaking — no shared state changes, no API contract changes. Chart components are extracted into dedicated files and lazy-loaded with `next/dynamic`. Notes queries are batched at the DB layer.

**Tech Stack:** Next.js 16 App Router, TypeScript, Recharts, Supabase, TanStack Query, shadcn/ui Skeleton

---

## Task 1: Batch notes queries (N+1 → 1 query)

**Files:**
- Modify: `src/lib/sheets/notes.ts`
- Modify: `src/app/api/sessions/[id]/route.ts`

### Problem
`GET /api/sessions/[id]` fires one DB query per student in the session to fetch their notes.
With 10 students → 11 round trips (1 students + 1 attendance + 10 notes).

### Fix

- [ ] **Step 1: Add `fetchNotesForMultipleStudents` to notes.ts**

```typescript
// src/lib/sheets/notes.ts — add after fetchNotesForStudent

export async function fetchNotesForMultipleStudents(
  studentIds: string[],
): Promise<Record<string, Note[]>> {
  if (studentIds.length === 0) return {};
  const { data } = await db
    .from("notes")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  const result: Record<string, Note[]> = {};
  for (const id of studentIds) result[id] = [];
  for (const note of (data ?? []) as Note[]) {
    result[note.student_id].push(note);
  }
  return result;
}
```

- [ ] **Step 2: Use it in the session detail route**

Replace lines 7 and 28–33 in `src/app/api/sessions/[id]/route.ts`:

```typescript
// Remove:
import { fetchNotesForStudent } from "@/lib/sheets/notes";
// Add:
import { fetchNotesForMultipleStudents } from "@/lib/sheets/notes";

// Replace the notesByStudent block:
const notesByStudent = await fetchNotesForMultipleStudents(
  sessionStudents.map((s) => s.id),
);
```

Full updated GET handler (lines 9–44):
```typescript
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return new NextResponse("not found", { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const [students, attendance] = await Promise.all([
      fetchStudents(),
      fetchAttendanceForSession(id),
    ]);
    const sessionStudents = students.filter((s) =>
      session.student_ids.includes(s.id),
    );
    const notesByStudent = await fetchNotesForMultipleStudents(
      sessionStudents.map((s) => s.id),
    );
    return NextResponse.json({
      session,
      students: sessionStudents,
      attendance,
      notesByStudent,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sheets/notes.ts src/app/api/sessions/[id]/route.ts
git commit -m "perf: batch notes queries in session detail API (N+1 → 1 query)"
```

---

## Task 2: Lazy-load Recharts in admin dashboard

**Files:**
- Create: `src/components/admin-charts.tsx`
- Modify: `src/components/admin-dashboard.tsx`

### Problem
`admin-dashboard.tsx` eagerly imports `BarChart`, `PieChart`, etc. from Recharts (~100KB minified).
These charts only render after data loads (which requires an API call), so there's no benefit to including them in the initial bundle.

### Fix

- [ ] **Step 1: Create `src/components/admin-charts.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminStats } from "@/app/api/admin/stats/route";

const TYPE_COLORS: Record<string, string> = {
  private: "#3b82f6",
  group: "#10b981",
  beginners: "#f59e0b",
  advanced: "#8b5cf6",
  technique: "#f97316",
  "match-play": "#f43f5e",
};

const BRAND = "#0b9e70";
const BRAND_FAINT = "rgba(11,158,112,0.18)";

export function AdminChartsRow({
  data,
  isLoading,
}: {
  data?: AdminStats;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
      {/* Bar chart — sessions per day */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">מפגשים השבוע</CardTitle>
            {data && (
              <span className="text-xs text-muted-foreground">
                סה״כ {data.weekSessionCount}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.sessionsByDay ?? []} barSize={28}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                  formatter={(v) => [`${v} מפגשים`, ""]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(data?.sessionsByDay ?? []).map((entry) => (
                    <Cell
                      key={entry.date}
                      fill={entry.date === data?.today ? BRAND : BRAND_FAINT}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Donut chart — by type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">לפי סוג אימון</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : !data?.sessionsByType.length ? (
            <p className="text-xs text-muted-foreground text-center py-10">אין נתונים השבוע</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={data.sessionsByType}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                  >
                    {data.sessionsByType.map((entry) => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v, _n, p) => [`${v} מפגשים`, p.payload.label]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5">
                {data.sessionsByType.map((t) => (
                  <div key={t.type} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[t.type] ?? "#94a3b8" }} />
                    <span className="flex-1 text-muted-foreground">{t.label}</span>
                    <span className="font-semibold tabular-nums">{t.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update `admin-dashboard.tsx` to lazy-import the charts row**

At the top, remove the recharts imports (lines 10–20) and add a dynamic import:

```tsx
// Remove these lines:
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// Add after the other imports:
import dynamic from "next/dynamic";

const AdminChartsRow = dynamic(
  () => import("@/components/admin-charts").then((m) => m.AdminChartsRow),
  { ssr: false },
);
```

Then replace the "Charts row" section in the JSX (the `<div className="grid grid-cols-1 md:grid-cols-3 ...">` block containing both cards, currently lines 102–190) with:

```tsx
{/* Charts row */}
<AdminChartsRow data={data} isLoading={isLoading} />
```

Also remove the `TYPE_COLORS`, `BRAND`, and `BRAND_FAINT` constants from `admin-dashboard.tsx` — they are now only in `admin-charts.tsx`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-charts.tsx src/components/admin-dashboard.tsx
git commit -m "perf: lazy-load Recharts in admin dashboard via dynamic import"
```

---

## Task 3: Lazy-load Recharts in coach dashboard

**Files:**
- Create: `src/components/coach-charts.tsx`
- Modify: `src/components/coach-dashboard.tsx`

- [ ] **Step 1: Create `src/components/coach-charts.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CoachStats } from "@/app/api/coach/stats/route";

export function CoachBarChart({
  data,
  isLoading,
}: {
  data?: CoachStats;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">מפגשים השבוע</CardTitle>
          {data && (
            <span className="text-xs text-muted-foreground">
              סה״כ {data.weekSessionCount}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data?.sessionsByDay ?? []} barSize={24}>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--background))",
                }}
                formatter={(v) => [`${v} מפגשים`, ""]}
                labelFormatter={() => ""}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(data?.sessionsByDay ?? []).map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.date === data?.today
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.25)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update `coach-dashboard.tsx`**

Remove the recharts imports (lines 8–16) and add dynamic import:

```tsx
// Remove:
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Add:
import dynamic from "next/dynamic";

const CoachBarChart = dynamic(
  () => import("@/components/coach-charts").then((m) => m.CoachBarChart),
  { ssr: false },
);
```

Replace the "Bar chart" Card section (the `<Card>` block containing `BarChart`, currently lines 104–155) with:

```tsx
{/* Bar chart */}
<CoachBarChart data={data} isLoading={isLoading} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/coach-charts.tsx src/components/coach-dashboard.tsx
git commit -m "perf: lazy-load Recharts in coach dashboard via dynamic import"
```

---

## Task 4: Add loading.tsx skeleton screens

**Files:**
- Create: `src/app/(admin)/admin/loading.tsx`
- Create: `src/app/(coach)/coach/loading.tsx`

### Why
Without `loading.tsx`, the browser shows a blank screen during route transitions to `/admin` and `/coach`. These skeleton screens appear instantly and set the correct layout before any JS runs.

- [ ] **Step 1: Create `src/app/(admin)/admin/loading.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <Skeleton className="h-8 w-52" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="md:col-span-2 h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      {/* Sessions list */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(coach)/coach/loading.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function CoachLoading() {
  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <Skeleton className="h-8 w-52" />
      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Hero card */}
      <Skeleton className="h-44 rounded-xl" />
      {/* Bar chart */}
      <Skeleton className="h-44 rounded-xl" />
      {/* Sessions list */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(admin)/admin/loading.tsx src/app/(coach)/coach/loading.tsx
git commit -m "perf: add loading.tsx skeleton screens for admin and coach routes"
```
