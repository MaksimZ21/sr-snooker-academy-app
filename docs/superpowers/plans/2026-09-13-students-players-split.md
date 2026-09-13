# Students/Players Split + Player Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/students` splits into two tabs ("מתאמנים" / "שחקנים") instead of mixing tournament-only customers into the regular list as fake "inactive" students; a real student's detail page gets a button to proactively make them a "player" (generate a `public_slug`) without touching anything else about their record.

**Architecture:** No schema changes — `is_tournament_only` and `public_slug` already exist on `students`. A new shared `ensurePlayerSlug` function replaces duplicated inline logic in the tournament-participant-add path and backs a new admin-only activation endpoint.

**Tech Stack:** Next.js API routes, Supabase, TanStack Query, shadcn/ui `Tabs`.

See `docs/superpowers/specs/2026-09-13-students-players-split-design.md` for the full design and the three decisions this plan implements.

---

### Task 1: `ensurePlayerSlug` data layer + refactor

**Files:**
- Modify: `src/lib/sheets/players.ts`
- Modify: `src/lib/sheets/tournaments.ts` (inside `addTournamentParticipant`, currently around lines 130-142)

- [ ] **Step 1: Add `ensurePlayerSlug` to `players.ts`**

Add this import at the top of `src/lib/sheets/players.ts` (alongside the existing `db` and `studentFullName` imports):

```ts
import { generatePublicSlug } from "@/lib/sheets/tournaments-slug";
```

Add this new exported function anywhere in the file (e.g. after `fetchPlayers`):

```ts
/**
 * Gives a student a public player profile if they don't already have one —
 * the exact same lazy slug generation that happens automatically the first
 * time a student is added to a tournament, but callable directly (e.g. from
 * an admin action on a student who hasn't played a tournament yet). Purely
 * additive: touches only public_slug, nothing else on the student record.
 * Idempotent and race-safe via the `.is("public_slug", null)` guard.
 */
export async function ensurePlayerSlug(studentId: string): Promise<void> {
  const { data: existing } = await db.from("students").select("public_slug").eq("id", studentId).maybeSingle();
  if (existing && !existing.public_slug) {
    await db.from("students").update({ public_slug: generatePublicSlug() }).eq("id", studentId).is("public_slug", null);
  }
}
```

- [ ] **Step 2: Refactor `addTournamentParticipant` to use it**

In `src/lib/sheets/tournaments.ts`, find this block inside `addTournamentParticipant` (in the `else` branch, for an existing student):

```ts
    // Existing student — this may be their first-ever tournament, in which
    // case they don't have a public_slug yet. Generate one now, lazily,
    // exactly once (never overwritten on subsequent tournaments). The
    // `.is("public_slug", null)` guard on the update makes this safe
    // against a race between two near-simultaneous adds of the same
    // student: only the update that still finds it null actually applies.
    const { data: existing } = await db.from("students").select("public_slug").eq("id", studentId).maybeSingle();
    if (existing && !existing.public_slug) {
      await db.from("students").update({ public_slug: generatePublicSlug() }).eq("id", studentId).is("public_slug", null);
    }
```

Replace it with:

```ts
    // Existing student — this may be their first-ever tournament, in which
    // case they don't have a public_slug yet. ensurePlayerSlug generates
    // one lazily, exactly once (never overwritten on subsequent
    // tournaments) — same logic an admin can also trigger directly from a
    // student's profile page, extracted to src/lib/sheets/players.ts.
    const { ensurePlayerSlug } = await import("./players");
    await ensurePlayerSlug(studentId);
```

This matches the existing dynamic-import style already used two lines above in the same function (`const { appendStudent } = await import("./students");`) — don't change that to a static import.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `generatePublicSlug` is still imported at the top of `tournaments.ts` and now unused there because of this refactor — check: it's still used elsewhere in that same file (`createTournament`, and the `is_tournament_only` new-customer branch of `addTournamentParticipant`), so the import stays. Don't remove it.

- [ ] **Step 4: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets/players.ts src/lib/sheets/tournaments.ts
git commit -m "feat(players): add ensurePlayerSlug, reuse it in addTournamentParticipant"
```

---

### Task 2: Player-activation API route

**Files:**
- Create: `src/app/api/admin/students/[id]/activate-player/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { ensurePlayerSlug } from "@/lib/sheets/players";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    await ensurePlayerSlug(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/students
git commit -m "feat(players): add POST /api/admin/students/[id]/activate-player"
```

---

### Task 3: `/admin/students` — two tabs, suppressed badge for tournament customers

**Files:**
- Modify: `src/components/students-list.tsx` (full-file replacement)

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddStudentDialog } from "@/components/forms/add-student-dialog";
import { EditStudentDialog } from "@/components/forms/edit-student-dialog";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import { History, Pencil, Search, Trash2, X, Check, GraduationCap, ChevronLeft, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";

type Category = "students" | "players";

export function StudentsList() {
  const [category, setCategory] = useState<Category>("students");
  const [selected, setSelected] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const queryClient = useQueryClient();

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const r = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("המתאמן נמחק");
    } catch {
      toast.error("שגיאה במחיקה");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    staleTime: 5 * 60_000,
  });

  const inviteMut = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => toast.success("קישור נשלח למייל"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשליחת הקישור"),
  });

  const studentsOnly = useMemo(
    () => (data?.students ?? []).filter((s) => !s.is_tournament_only),
    [data],
  );
  const playersOnly = useMemo(
    () => (data?.students ?? []).filter((s) => s.is_tournament_only),
    [data],
  );
  const categoryRows = category === "students" ? studentsOnly : playersOnly;

  const colleges = useMemo(() => {
    const names = studentsOnly.map((s) => s.college_name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [studentsOnly]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categoryRows.filter((s) => {
      if (category === "students") {
        if (statusFilter === "active" && !s.active) return false;
        if (statusFilter === "inactive" && s.active) return false;
        if (collegeFilter !== "all" && s.college_name !== collegeFilter) return false;
      }
      if (!q) return true;
      return (
        studentFullName(s).toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [categoryRows, category, search, statusFilter, collegeFilter]);

  const hasFilters = Boolean(search) || (category === "students" && (statusFilter !== "all" || collegeFilter !== "all"));

  function changeCategory(v: string) {
    setCategory(v as Category);
    setSearch("");
    setStatusFilter("all");
    setCollegeFilter("all");
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<GraduationCap size={20} />}
        title="מתאמנים"
        subtitle={
          isLoading
            ? "טוען..."
            : `${filtered.length} ${category === "students" ? "מתאמנים" : "שחקנים"}${hasFilters ? ` מתוך ${categoryRows.length}` : ""}`
        }
        action={<AddStudentDialog />}
      />
      <div className="px-4 md:px-6 flex flex-col gap-4">

      <Tabs value={category} onValueChange={changeCategory} dir="rtl">
        <TabsList>
          <TabsTrigger value="students">מתאמנים{studentsOnly.length > 0 ? ` (${studentsOnly.length})` : ""}</TabsTrigger>
          <TabsTrigger value="players">שחקנים{playersOnly.length > 0 ? ` (${playersOnly.length})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="חיפוש לפי שם, טלפון, מייל..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 h-9 text-sm"
            dir="rtl"
          />
        </div>
        {category === "students" && (
          <>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-32 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
            {colleges.length > 0 && (
              <Select value={collegeFilter} onValueChange={(v) => setCollegeFilter(v ?? "all")}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                  <SelectValue placeholder="כל המכללות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המכללות</SelectItem>
                  {colleges.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={() => { setSearch(""); setStatusFilter("all"); setCollegeFilter("all"); }}
            title="נקה סינון"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm shadow-foreground/[0.04] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {hasFilters
              ? "לא נמצאו תוצאות תואמות לסינון"
              : category === "students"
                ? "אין מתאמנים עדיין"
                : "אין שחקנים עדיין"}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((s) => (
              <StudentRow
                key={s.id}
                student={s}
                hideInactiveBadge={category === "players"}
                confirmDelete={confirmDelete}
                deleting={deleting}
                onEdit={() => setEditing(s)}
                onHistory={() => setSelected(s)}
                onDeleteRequest={() => setConfirmDelete(s.id)}
                onDeleteConfirm={() => handleDelete(s.id)}
                onDeleteCancel={() => setConfirmDelete(null)}
                onInvite={() => inviteMut.mutate(s.email)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <StudentHistoryDialog
          studentId={selected.id}
          studentName={studentFullName(selected)}
          open={true}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
      {editing && (
        <EditStudentDialog
          student={editing}
          open={true}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
        />
      )}
      </div>
    </div>
  );
}

function StudentRow({
  student: s,
  hideInactiveBadge,
  confirmDelete,
  deleting,
  onEdit,
  onHistory,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onInvite,
}: {
  student: Student;
  hideInactiveBadge: boolean;
  confirmDelete: string | null;
  deleting: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onInvite: () => void;
}) {
  const name = studentFullName(s);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const isConfirming = confirmDelete === s.id;

  const info = [s.phone, s.email, s.college_name].filter(Boolean).join(" · ");

  return (
    <div className={cn(
      "group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150",
      "hover:bg-muted/40 dark:hover:bg-white/[0.03]",
      isConfirming && "bg-destructive/5 dark:bg-destructive/10",
    )}>
      {/* Avatar + name — link to detail page */}
      <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 flex-1 min-w-0 group/link">
        <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0 select-none group-hover/link:bg-primary/20 transition-colors">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-none group-hover/link:text-primary transition-colors">{name}</span>
            {!hideInactiveBadge && !s.active && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">לא פעיל</Badge>
            )}
          </div>
          {info && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info}</p>
          )}
        </div>
        <ChevronLeft size={13} className="text-muted-foreground/20 group-hover/link:text-primary/40 transition-colors shrink-0" />
      </Link>

      {/* Actions */}
      {isConfirming ? (
        <div className="flex items-center gap-1 shrink-0 animate-scale-in">
          <span className="text-xs text-destructive font-medium ml-1">למחוק?</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={onDeleteConfirm}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDeleteCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30"
            title={s.email ? "שלח קישור הזמנה" : "אין מייל למתאמן זה"}
            disabled={!s.email}
            onClick={onInvite}
          >
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="עריכה"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="היסטוריית נוכחות"
            onClick={onHistory}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="מחיקה"
            onClick={onDeleteRequest}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

Note: `TabsContent` is not imported/used — the tabs here only drive filter state, not separate rendered panels (both categories reuse the exact same list/filter JSX below the `Tabs`), so only `Tabs`, `TabsList`, `TabsTrigger` are needed. Do not add a `TabsContent` wrapper — the single list below is shared and swaps its filtered contents based on `category` state, it does not live inside per-tab panels.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/students-list.tsx
git commit -m "feat(players): split /admin/students into מתאמנים/שחקנים tabs"
```

---

### Task 4: Student detail page — activation button / player indicator

**Files:**
- Modify: `src/app/(admin)/admin/students/[id]/page.tsx`

- [ ] **Step 1: Update imports**

The current top of the file reads:

```tsx
"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Mail,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StudentGoalSummary } from "@/components/student-goal-summary";
import { cn } from "@/lib/utils";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note, Session, Attendance } from "@/lib/sheets/schemas";
import type { Assessment } from "@/lib/sheets/assessment-types";
import { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "@/lib/sheets/assessment-types";
```

Change it to:

```tsx
"use client";
import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Mail,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  ClipboardList,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentGoalSummary } from "@/components/student-goal-summary";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { studentFullName } from "@/lib/sheets/schemas";
import type { Student, Note, Session, Attendance } from "@/lib/sheets/schemas";
import type { Assessment } from "@/lib/sheets/assessment-types";
import { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "@/lib/sheets/assessment-types";
```

(Adds `useMutation`, `useQueryClient`, `Trophy`, `Button`, `toast` — everything else on those lines is unchanged.)

- [ ] **Step 2: Add the mutation**

Find this line inside `AdminStudentDetailPage`:

```tsx
export default function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
```

Change it to:

```tsx
export default function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const activatePlayerMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/students/${id}/activate-player`, { method: "POST" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("אזור הטורנירים נפתח למתאמן");
      queryClient.invalidateQueries({ queryKey: ["admin:student", id] });
    },
    onError: () => toast.error("שגיאה בפתיחת אזור הטורנירים"),
  });

  const { data, isLoading } = useQuery({
```

- [ ] **Step 3: Add the button/indicator to the header pills row**

Find this block (the pills row under the name/avatar, before the closing of the header section):

```tsx
          <div className="flex items-center gap-2.5 flex-wrap mt-4">
            {student.phone && (
              <span className="flex items-center gap-1.5 text-white/70 text-xs">
                <Phone size={11} />
                {student.phone}
              </span>
            )}
            {student.email && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Mail size={11} />
                {student.email}
              </span>
            )}
            {student.subscription_type && (
              <span className="bg-white/15 text-white/85 text-xs px-2.5 py-0.5 rounded-full">
                {student.subscription_type}
              </span>
            )}
            {student.college_name && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Users size={11} />
                {student.college_name}
              </span>
            )}
          </div>
```

Add a new block right after it (still inside the same parent `<div>` the pills row is in, as a sibling after the pills row `</div>`):

```tsx
          <div className="flex items-center gap-2.5 flex-wrap mt-4">
            {student.phone && (
              <span className="flex items-center gap-1.5 text-white/70 text-xs">
                <Phone size={11} />
                {student.phone}
              </span>
            )}
            {student.email && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Mail size={11} />
                {student.email}
              </span>
            )}
            {student.subscription_type && (
              <span className="bg-white/15 text-white/85 text-xs px-2.5 py-0.5 rounded-full">
                {student.subscription_type}
              </span>
            )}
            {student.college_name && (
              <span className="flex items-center gap-1.5 text-white/60 text-xs">
                <Users size={11} />
                {student.college_name}
              </span>
            )}
          </div>

          {!student.is_tournament_only && (
            <div className="mt-3">
              {student.public_slug ? (
                <span className="flex items-center gap-1.5 w-fit bg-white/15 text-white/85 text-xs px-2.5 py-1 rounded-full">
                  <Trophy size={12} />
                  שחקן טורנירים
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                  disabled={activatePlayerMut.isPending}
                  onClick={() => activatePlayerMut.mutate()}
                >
                  <Trophy size={12} className="ml-1.5" />
                  {activatePlayerMut.isPending ? "פותח..." : "פתח לו את אזור הטורנירים"}
                </Button>
              )}
            </div>
          )}
```

This renders nothing for `is_tournament_only` students (they're already players by construction), a small "שחקן טורנירים" pill for a real student who already has a `public_slug` (whether they got it from this button or from actually being added to a tournament), and the activation button otherwise. Neither the pill nor the button navigate anywhere — confirmed explicitly with the user that this action must not act as a link.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(admin)/admin/students/[id]/page.tsx"
git commit -m "feat(players): add player-activation button to student detail page"
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
