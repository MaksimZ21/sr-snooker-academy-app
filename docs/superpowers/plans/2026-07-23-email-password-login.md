# Email + Password Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore email+password as a login option on both login tabs, let an admin manually trigger a Supabase invite/reset email per coach or student so they can set their own password, and give every role a way to change their password later.

**Architecture:** Reuses Supabase Auth's built-in `signInWithPassword`, `inviteUserByEmail`, `resetPasswordForEmail`, and `updateUser` — no custom password storage or delivery mechanism. The only new backend surface is one admin-only API route that wraps `inviteUserByEmail`/`resetPasswordForEmail` with a fallback. Everything else is UI wiring on top of existing, working pieces (`/set-password`, `/auth/callback`, `ProfileCard`).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase Auth (`@supabase/ssr`, `@supabase/supabase-js`), TanStack Query, zod, sonner toasts, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-23-email-password-login-design.md`

**Conventions note:** this codebase has no test coverage for API routes or React components (only pure logic in `src/lib/auth/*Role*.ts`, `src/lib/date.ts`, `src/lib/sheets/schemas.ts` is unit-tested). This plan follows that pattern — verification steps use `npx tsc --noEmit` for fast type-checking per task and manual browser/API checks instead of writing new test files, matching how the rest of the auth/admin surface in this codebase is verified today.

---

### Task 1: Restore email+password on the login page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Rename `StaffLoginForm` to `EmailPasswordLoginForm` and drop the stale comment**

Find:
```tsx
// StaffLoginForm kept for potential future use (password login)
function StaffLoginForm() {
```
Replace with:
```tsx
function EmailPasswordLoginForm() {
```

- [ ] **Step 2: Delete the old email-OTP student flow**

Find and delete this entire block (the blank line before `type OtpStep`, the `OtpStep` type, and the whole `StudentLoginForm` function — everything between the end of `EmailPasswordLoginForm` from Step 1 and the `type WaStep = "phone" | "code";` line):
```tsx


type OtpStep = "email" | "code";

function StudentLoginForm() {
  const [step, setStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
    setLoading(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/student";
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyOtp} className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground text-center">
          שלחנו קוד ל-{email}
        </p>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="קוד בן 6 ספרות"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          maxLength={6}
          dir="ltr"
          className="text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
          {loading ? "מאמת..." : "אימות"}
        </Button>
        <button
          type="button"
          onClick={() => setStep("email")}
          className="text-sm text-muted-foreground underline text-center"
        >
          שנה מייל
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendOtp} className="flex flex-col gap-3">
      <Input
        type="email"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        dir="ltr"
      />
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
        {loading ? "שולח קוד..." : "שלח קוד"}
      </Button>
    </form>
  );
}
```

Nothing should remain between the closing `}` of `EmailPasswordLoginForm` and `type WaStep = "phone" | "code";`.

- [ ] **Step 3: Rewrite `LoginTabs` so both tabs can toggle between WhatsApp and email+password**

Find:
```tsx
type Tab = "staff" | "student";

function LoginTabs() {
  const [tab, setTab] = useState<Tab>("staff");
  const [showWa, setShowWa] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => { setTab("staff"); setShowWa(false); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => { setTab("student"); setShowWa(false); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>

      {tab === "staff" ? (
        <WhatsAppLoginForm />
      ) : showWa ? (
        <div className="flex flex-col gap-3">
          <WhatsAppLoginForm />
          <button
            type="button"
            onClick={() => setShowWa(false)}
            className="text-sm text-muted-foreground underline text-center"
          >
            חזור לכניסה עם אימייל
          </button>
        </div>
      ) : (
        <>
          <StudentLoginForm />
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">או</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-11 gap-2 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
            onClick={() => setShowWa(true)}
          >
            <MessageCircle size={17} />
            כניסה עם WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}
```
Replace with:
```tsx
type Tab = "staff" | "student";

function LoginTabs() {
  const [tab, setTab] = useState<Tab>("staff");
  // Staff defaults to WhatsApp; student defaults to email+password. Each tab button resets to its own default.
  const [showWa, setShowWa] = useState(true);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => { setTab("staff"); setShowWa(true); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => { setTab("student"); setShowWa(false); }}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>

      {showWa ? (
        <div className="flex flex-col gap-3">
          <WhatsAppLoginForm />
          <button
            type="button"
            onClick={() => setShowWa(false)}
            className="text-sm text-muted-foreground underline text-center"
          >
            כניסה עם מייל וסיסמה
          </button>
        </div>
      ) : (
        <>
          <EmailPasswordLoginForm />
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">או</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-11 gap-2 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10"
            onClick={() => setShowWa(true)}
          >
            <MessageCircle size={17} />
            כניסה עם WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (specifically, no "cannot find name 'StaffLoginForm'/'StudentLoginForm'/'OtpStep'" errors).

- [ ] **Step 5: Manual check in the browser**

Run: `npm run dev`, open `http://localhost:3000/login`.
Expected:
- "מאמן / אדמין" tab shows the WhatsApp form by default, with a "כניסה עם מייל וסיסמה" text link below it that swaps in the email+password form.
- "מתאמן" tab shows the email+password form by default, with the green "כניסה עם WhatsApp" button below it that swaps in the WhatsApp form.
- Switching tabs always resets to that tab's default form.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(login): restore email+password as an option on both login tabs"
```

---

### Task 2: `sendLoginInvite` helper

**Files:**
- Create: `src/lib/auth/invite.ts`

- [ ] **Step 1: Write the helper**

```ts
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function sendLoginInvite(email: string, origin: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const redirectTo = `${origin}/auth/callback?next=/set-password`;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error) return;

  // Most common failure here is "user already registered" (e.g. re-sending to
  // an existing coach/student) — fall back to a password-reset email instead.
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) throw new Error(`invite_failed: ${resetError.message}`);
}
```

`origin` is passed in by the caller (derived from the incoming request URL) rather than read from an env var, so this can't break the way the old flow did when `NEXT_PUBLIC_SITE_URL` was unset.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/invite.ts
git commit -m "feat(auth): add sendLoginInvite helper for admin-triggered invite emails"
```

---

### Task 3: `POST /api/admin/invite` route

**Files:**
- Create: `src/app/api/admin/invite/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { sendLoginInvite } from "@/lib/auth/invite";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { email } = z.object({ email: z.email() }).parse(await req.json());
    const origin = new URL(req.url).origin;
    await sendLoginInvite(email, origin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return new NextResponse(msg, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run: `npm run dev`. While logged in as an admin (in a browser session), open devtools console on any admin page and run:
```js
fetch("/api/admin/invite", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "<your own real test email here>" }),
}).then(r => r.text()).then(console.log)
```
Expected: `{"ok":true}` and an invite (or password reset) email arrives at that address, with a link that lands on `/set-password` after going through `/auth/callback`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/invite/route.ts"
git commit -m "feat(api): add admin-only endpoint to send login invite emails"
```

---

### Task 4: "Send invite link" button on the coaches list

**Files:**
- Modify: `src/components/coaches-list.tsx`

- [ ] **Step 1: Add the `Mail` icon import**

Find:
```tsx
import { History, Trash2, Pencil, Users } from "lucide-react";
```
Replace with:
```tsx
import { History, Trash2, Pencil, Users, Mail } from "lucide-react";
```

- [ ] **Step 2: Add the invite mutation inside `CoachesList`**

Find:
```tsx
  const deleteMut = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/coaches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המאמן נמחק");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setToDelete(null);
    },
    onError: () => toast.error("שגיאה במחיקת המאמן"),
  });
```
Replace with (adds a new mutation right after it, deleteMut unchanged):
```tsx
  const deleteMut = useMutation({
    mutationFn: async (email: string) => {
      const r = await fetch("/api/coaches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("המאמן נמחק");
      qc.invalidateQueries({ queryKey: ["coaches"] });
      setToDelete(null);
    },
    onError: () => toast.error("שגיאה במחיקת המאמן"),
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
```

- [ ] **Step 3: Pass an `onInvite` handler down to `CoachRow`**

Find:
```tsx
              <CoachRow
                key={c.email}
                coach={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setToDelete(c)}
              />
```
Replace with:
```tsx
              <CoachRow
                key={c.email}
                coach={c}
                onEdit={() => openEdit(c)}
                onDelete={() => setToDelete(c)}
                onInvite={() => inviteMut.mutate(c.email)}
              />
```

- [ ] **Step 4: Render the invite button in `CoachRow`**

Find:
```tsx
function CoachRow({ coach: c, onEdit, onDelete }: {
  coach: Coach;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const info = [c.email, c.phone].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 dark:hover:bg-white/[0.03]">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-[11px] font-bold shrink-0 select-none shadow-sm">
        {getInitials(c.name)}
      </div>

      {/* Name + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-none">{c.name}</span>
          {!c.active && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">לא פעיל</Badge>
          )}
        </div>
        {info && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info}</p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className={cn(
        "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
        "opacity-0 group-hover:opacity-100",
      )}>
        <Link
          href={`/admin/coaches/sessions?coach=${encodeURIComponent(c.email)}`}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="מפגשים"
        >
          <History size={14} />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="עריכה"
          onClick={onEdit}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="מחיקה"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
```
Replace with:
```tsx
function CoachRow({ coach: c, onEdit, onDelete, onInvite }: {
  coach: Coach;
  onEdit: () => void;
  onDelete: () => void;
  onInvite: () => void;
}) {
  const info = [c.email, c.phone].filter(Boolean).join(" · ");

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 dark:hover:bg-white/[0.03]">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-gradient text-white flex items-center justify-center text-[11px] font-bold shrink-0 select-none shadow-sm">
        {getInitials(c.name)}
      </div>

      {/* Name + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-none">{c.name}</span>
          {!c.active && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">לא פעיל</Badge>
          )}
        </div>
        {info && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{info}</p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className={cn(
        "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
        "opacity-0 group-hover:opacity-100",
      )}>
        <Link
          href={`/admin/coaches/sessions?coach=${encodeURIComponent(c.email)}`}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="מפגשים"
        >
          <History size={14} />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="שלח קישור הזמנה"
          onClick={onInvite}
        >
          <Mail size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="עריכה"
          onClick={onEdit}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="מחיקה"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, open `/admin/coaches` as an admin, hover a coach row, click the new mail icon.
Expected: success toast "קישור נשלח למייל", and the invite email arrives.

- [ ] **Step 7: Commit**

```bash
git add src/components/coaches-list.tsx
git commit -m "feat(coaches): add manual invite-link button to coach rows"
```

---

### Task 5: "Send invite link" button on the students list

**Files:**
- Modify: `src/components/students-list.tsx`

- [ ] **Step 1: Add `useMutation` and the `Mail` icon to imports**

Find:
```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
```
Replace with:
```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```
Find:
```tsx
import { History, Pencil, Search, Trash2, X, Check, GraduationCap, ChevronLeft } from "lucide-react";
```
Replace with:
```tsx
import { History, Pencil, Search, Trash2, X, Check, GraduationCap, ChevronLeft, Mail } from "lucide-react";
```

- [ ] **Step 2: Add the invite mutation inside `StudentsList`**

Find:
```tsx
  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const r = await fetch("/api/students");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { students: Student[] };
    },
    staleTime: 5 * 60_000,
  });
```
Replace with:
```tsx
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
```

- [ ] **Step 3: Pass `onInvite` down to `StudentRow`**

Find:
```tsx
              <StudentRow
                key={s.id}
                student={s}
                confirmDelete={confirmDelete}
                deleting={deleting}
                onEdit={() => setEditing(s)}
                onHistory={() => setSelected(s)}
                onDeleteRequest={() => setConfirmDelete(s.id)}
                onDeleteConfirm={() => handleDelete(s.id)}
                onDeleteCancel={() => setConfirmDelete(null)}
              />
```
Replace with:
```tsx
              <StudentRow
                key={s.id}
                student={s}
                confirmDelete={confirmDelete}
                deleting={deleting}
                onEdit={() => setEditing(s)}
                onHistory={() => setSelected(s)}
                onDeleteRequest={() => setConfirmDelete(s.id)}
                onDeleteConfirm={() => handleDelete(s.id)}
                onDeleteCancel={() => setConfirmDelete(null)}
                onInvite={() => inviteMut.mutate(s.email)}
              />
```

- [ ] **Step 4: Render the invite button in `StudentRow`, disabled when there's no email**

Find:
```tsx
function StudentRow({
  student: s,
  confirmDelete,
  deleting,
  onEdit,
  onHistory,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  student: Student;
  confirmDelete: string | null;
  deleting: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
```
Replace with:
```tsx
function StudentRow({
  student: s,
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
  confirmDelete: string | null;
  deleting: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onInvite: () => void;
}) {
```

Find:
```tsx
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
```
Replace with:
```tsx
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
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, open `/admin/students` as an admin. Hover a student row that has an email — click the mail icon, expect the success toast and an email. Hover a student row with no email — mail icon should be visibly disabled and not clickable.

- [ ] **Step 7: Commit**

```bash
git add src/components/students-list.tsx
git commit -m "feat(students): add manual invite-link button to student rows"
```

---

### Task 6: Self-service password change from the profile page

**Files:**
- Modify: `src/components/profile-card.tsx`

- [ ] **Step 1: Add the "שינוי סיסמה" button and student role label**

Find:
```tsx
export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <div className="p-4">
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient-soft h-20" />
        <CardContent className="-mt-10 flex flex-col items-center gap-4 pb-6">
          <Avatar className="h-20 w-20 ring-4 ring-background bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <div className="font-mono text-sm">{email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {role === "admin" ? "מנהל" : "מאמן"}
            </div>
          </div>
          <Button variant="outline" onClick={signOut}>
            התנתקות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```
Replace with:
```tsx
export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
  }
  function changePassword() {
    window.location.href = "/set-password";
  }
  return (
    <div className="p-4">
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient-soft h-20" />
        <CardContent className="-mt-10 flex flex-col items-center gap-4 pb-6">
          <Avatar className="h-20 w-20 ring-4 ring-background bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <div className="font-mono text-sm">{email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {role === "admin" ? "מנהל" : role === "student" ? "מתאמן" : "מאמן"}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={changePassword}>
              שינוי סיסמה
            </Button>
            <Button variant="outline" onClick={signOut}>
              התנתקות
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile-card.tsx
git commit -m "feat(profile): add change-password button and student role label"
```

---

### Task 7: Student profile page and nav item

**Files:**
- Create: `src/app/(student)/student/profile/page.tsx`
- Modify: `src/components/nav-items.ts`

- [ ] **Step 1: Create the student profile page (mirrors the existing admin/coach ones)**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { ProfileCard } from "@/components/profile-card";

export default async function Page() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  const role = await getUserRole(user!.email!);
  return <ProfileCard email={user!.email!} role={role} />;
}
```

- [ ] **Step 2: Add the nav item**

Find:
```ts
export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "האימונים שלי", icon: "Calendar" },
  { href: "/student/history", label: "היסטוריה", icon: "History" },
  { href: "/student/contact", label: "פנייה לאדמין", icon: "MessageSquare" },
];
```
Replace with:
```ts
export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "האימונים שלי", icon: "Calendar" },
  { href: "/student/history", label: "היסטוריה", icon: "History" },
  { href: "/student/contact", label: "פנייה לאדמין", icon: "MessageSquare" },
  { href: "/student/profile", label: "פרופיל", icon: "User" },
];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, log in as a student, confirm a "פרופיל" nav item now appears and `/student/profile` renders the profile card with "מתאמן" as the role label, a working "שינוי סיסמה" button, and a working "התנתקות" button.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(student)/student/profile/page.tsx" src/components/nav-items.ts
git commit -m "feat(student): add profile page with password-change access"
```

---

### Task 8: Full build and end-to-end check

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: build succeeds with no TypeScript or lint errors.

- [ ] **Step 2: End-to-end manual walkthrough**

Using `npm run dev`:
1. `/login`, staff tab → toggle to email+password → confirm the form renders (don't need valid credentials to check rendering).
2. `/login`, student tab → confirm email+password renders by default, toggle to WhatsApp and back.
3. As admin, `/admin/coaches` → click invite icon on a real coach row → confirm email arrives → open the link → land on `/set-password` → set a password → confirm redirect ends up on `/admin` or `/coach` per that account's role.
4. As admin, `/admin/students` → same check on a student row that has an email, and confirm a student with no email shows the invite icon disabled.
5. Log in with the newly-set email+password on the login page's email+password form → confirm successful login.
6. As that same user, go to their profile page → "שינוי סיסמה" → `/set-password` → set a new password → log out → log back in with the new password.
7. Confirm WhatsApp OTP login still works unchanged on both tabs for an account that hasn't touched any of the above.

Expected: all steps succeed with no console errors.

- [ ] **Step 3: Confirm CRM webhook path is untouched**

Run: `git diff main --stat` (or review the task history above) and confirm `src/lib/sheets/students.ts` (specifically `upsertStudentFromCrm` and `appendStudent`) was never modified by this plan.
Expected: no changes to that file.
