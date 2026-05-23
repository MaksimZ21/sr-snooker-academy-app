# Student Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a student-facing portal where academy students can view upcoming sessions, attendance history, and contact the admin — with Email OTP login via a new tab on the existing login page.

**Architecture:** New `(student)` route group mirroring `(coach)` / `(admin)`. A `student` role is added to `resolveRole`. Students authenticate via Supabase Email OTP on the shared `/login` page (new tab alongside existing staff login). A new `contact_requests` Supabase table stores student messages; the admin sees them at `/admin/messages`.

**Tech Stack:** Next.js App Router (server components), Supabase Auth (OTP), Supabase DB (service role client), Vitest, shadcn/ui, sonner (toasts), TanStack Query (admin messages list)

---

## File Map

**New files:**
- `src/lib/auth/resolveRole.test.ts` — unit tests for updated resolveRole
- `src/lib/sheets/contact.ts` — contact_requests DB module
- `src/app/(student)/layout.tsx` — student shell (auth + role guard)
- `src/app/(student)/student/page.tsx` — upcoming sessions server page
- `src/app/(student)/student/history/page.tsx` — attendance history server page
- `src/app/(student)/student/contact/page.tsx` — contact form page
- `src/components/student-contact-form.tsx` — contact form client component
- `src/components/admin-messages.tsx` — admin messages list client component
- `src/app/(admin)/admin/messages/page.tsx` — admin messages page
- `src/app/api/student/contact/route.ts` — POST contact request
- `src/app/api/admin/messages/route.ts` — GET messages + PATCH mark-read

**Modified files:**
- `src/lib/auth/resolveRole.ts` — add `student` role
- `src/lib/auth/getUserRole.ts` — pass active student emails to resolveRole
- `src/lib/sheets/students.ts` — add `fetchActiveStudentEmails`, `getStudentByEmail`
- `src/lib/sheets/sessions.ts` — add `fetchSessionsForStudent`
- `src/middleware.ts` — protect `/student` routes
- `src/app/page.tsx` — redirect `student` role to `/student`
- `src/app/login/page.tsx` — add student OTP tab
- `src/components/nav-items.ts` — add STUDENT_NAV and messages to ADMIN_NAV
- `src/app/api/admin/stats/route.ts` — add `newMessages` count to response
- `src/components/admin-dashboard.tsx` — add messages stat card

---

### Task 1: Add `student` role to resolveRole

**Files:**
- Modify: `src/lib/auth/resolveRole.ts`
- Create: `src/lib/auth/resolveRole.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/resolveRole.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveRole } from "./resolveRole";

const base = { adminEmails: "admin@a.com", activeCoachEmails: [], activeStudentEmails: [] };

describe("resolveRole", () => {
  it("returns admin for admin email", () => {
    expect(resolveRole({ ...base, email: "admin@a.com" })).toBe("admin");
  });

  it("returns coach for active coach email", () => {
    expect(resolveRole({ ...base, email: "coach@a.com", activeCoachEmails: ["coach@a.com"] })).toBe("coach");
  });

  it("returns student for active student email", () => {
    expect(resolveRole({ ...base, email: "student@a.com", activeStudentEmails: ["student@a.com"] })).toBe("student");
  });

  it("admin takes precedence over student", () => {
    expect(resolveRole({ ...base, email: "admin@a.com", activeStudentEmails: ["admin@a.com"] })).toBe("admin");
  });

  it("coach takes precedence over student", () => {
    expect(resolveRole({
      ...base,
      email: "coach@a.com",
      activeCoachEmails: ["coach@a.com"],
      activeStudentEmails: ["coach@a.com"],
    })).toBe("coach");
  });

  it("returns denied for unknown email", () => {
    expect(resolveRole({ ...base, email: "nobody@a.com" })).toBe("denied");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:run -- src/lib/auth/resolveRole.test.ts
```

Expected: FAIL — "Property 'activeStudentEmails' does not exist"

- [ ] **Step 3: Update resolveRole.ts**

Replace the full content of `src/lib/auth/resolveRole.ts`:

```typescript
export type Role = "admin" | "coach" | "student" | "denied";

export function resolveRole(input: {
  email: string;
  adminEmails: string;
  activeCoachEmails: string[];
  activeStudentEmails: string[];
}): Role {
  const email = input.email.trim().toLowerCase();
  const admins = input.adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(email)) return "admin";
  const coaches = input.activeCoachEmails.map((e) => e.trim().toLowerCase());
  if (coaches.includes(email)) return "coach";
  const students = input.activeStudentEmails.map((e) => e.trim().toLowerCase());
  if (students.includes(email)) return "student";
  return "denied";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- src/lib/auth/resolveRole.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/resolveRole.ts src/lib/auth/resolveRole.test.ts
git commit -m "feat(auth): add student role to resolveRole"
```

---

### Task 2: Add student DB helpers

**Files:**
- Modify: `src/lib/sheets/students.ts`

- [ ] **Step 1: Append helpers to students.ts**

Add these two functions at the end of `src/lib/sheets/students.ts` (after the last existing function):

```typescript
export const fetchActiveStudentEmails = unstable_cache(
  async (): Promise<string[]> => {
    const { data } = await db.from("students").select("email").eq("active", true);
    return (data ?? []).map((r) => (r.email as string).toLowerCase()).filter(Boolean);
  },
  ["students:active-emails"],
  { revalidate: 300, tags: ["students"] },
);

export async function getStudentByEmail(email: string): Promise<Student | null> {
  const { data } = await db
    .from("students")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data as Student) ?? null;
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/students.ts
git commit -m "feat(students): add fetchActiveStudentEmails and getStudentByEmail"
```

---

### Task 3: Wire student role into getUserRole + root redirect

**Files:**
- Modify: `src/lib/auth/getUserRole.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace getUserRole.ts**

Replace the full content of `src/lib/auth/getUserRole.ts`:

```typescript
import { revalidateTag } from "next/cache";
import { resolveRole, type Role } from "./resolveRole";
import { fetchActiveCoachEmails, readActiveCoachEmails } from "@/lib/sheets/coaches";
import { fetchActiveStudentEmails } from "@/lib/sheets/students";

export async function getUserRole(email: string): Promise<Role> {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const fastAdmin = resolveRole({ email, adminEmails, activeCoachEmails: [], activeStudentEmails: [] });
  if (fastAdmin === "admin") return "admin";

  const [cachedCoaches, cachedStudents] = await Promise.all([
    fetchActiveCoachEmails(),
    fetchActiveStudentEmails(),
  ]);
  const cachedRole = resolveRole({ email, adminEmails, activeCoachEmails: cachedCoaches, activeStudentEmails: cachedStudents });
  if (cachedRole !== "denied") return cachedRole;

  const fresh = await readActiveCoachEmails();
  const freshRole = resolveRole({ email, adminEmails, activeCoachEmails: fresh, activeStudentEmails: cachedStudents });
  if (freshRole !== "denied") {
    revalidateTag("coaches", { expire: 0 });
  }
  return freshRole;
}
```

- [ ] **Step 2: Update root page redirect**

Replace the full content of `src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getUserRole(user.email!);
  if (role === "admin") redirect("/admin");
  if (role === "coach") redirect("/coach");
  if (role === "student") redirect("/student");
  redirect("/denied");
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/getUserRole.ts src/app/page.tsx
git commit -m "feat(auth): wire student role into getUserRole and root redirect"
```

---

### Task 4: Create contact_requests table in Supabase

- [ ] **Step 1: Run this SQL in Supabase SQL Editor**

Go to your Supabase project → SQL Editor, and run:

```sql
create table if not exists contact_requests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references students(id),
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Verify the table was created**

In Supabase → Table Editor, confirm `contact_requests` appears with columns: `id`, `student_id`, `subject`, `message`, `status`, `created_at`.

---

### Task 5: Add contact DB module

**Files:**
- Create: `src/lib/sheets/contact.ts`

- [ ] **Step 1: Create contact.ts**

Create `src/lib/sheets/contact.ts`:

```typescript
import { db } from "@/lib/db/client";

export type ContactRequest = {
  id: string;
  student_id: string;
  subject: string;
  message: string;
  status: "new" | "read";
  created_at: string;
};

export async function insertContactRequest(input: {
  student_id: string;
  subject: string;
  message: string;
}): Promise<void> {
  await db.from("contact_requests").insert({
    student_id: input.student_id,
    subject: input.subject,
    message: input.message,
  });
}

export async function fetchContactRequests(): Promise<ContactRequest[]> {
  const { data } = await db
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as ContactRequest[];
}

export async function markContactRequestRead(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "read" }).eq("id", id);
}

export async function countNewContactRequests(): Promise<number> {
  const { count } = await db
    .from("contact_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/contact.ts
git commit -m "feat(contact): add contact_requests DB module"
```

---

### Task 6: Add fetchSessionsForStudent helper

**Files:**
- Modify: `src/lib/sheets/sessions.ts`

- [ ] **Step 1: Append to sessions.ts**

Add this function at the end of `src/lib/sheets/sessions.ts`:

```typescript
export async function fetchSessionsForStudent(studentId: string): Promise<Session[]> {
  const all = await fetchSessionsAll();
  return all
    .filter((s) => s.student_ids.includes(studentId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/sessions.ts
git commit -m "feat(sessions): add fetchSessionsForStudent"
```

---

### Task 7: Update middleware to protect /student

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add /student to PROTECTED**

In `src/middleware.ts`, change line 4 from:

```typescript
const PROTECTED = ["/coach", "/admin"];
```

to:

```typescript
const PROTECTED = ["/coach", "/admin", "/student"];
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): protect /student routes"
```

---

### Task 8: Add student OTP flow to login page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Replace login page with tabbed version**

Replace the full content of `src/app/login/page.tsx`:

```typescript
"use client";
import { Suspense, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useSearchParams } from "next/navigation";

function StaffLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const redirect = searchParams.get("redirect") ?? "/";
      window.location.href = redirect;
    }
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-3">
      <Input
        type="email"
        placeholder="אימייל"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        dir="ltr"
      />
      <Input
        type="password"
        placeholder="סיסמה"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        dir="ltr"
      />
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full h-12 text-base mt-1">
        {loading ? "מתחבר..." : "התחברות"}
      </Button>
    </form>
  );
}

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
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

type Tab = "staff" | "student";

function LoginTabs() {
  const [tab, setTab] = useState<Tab>("staff");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg text-sm">
        <button
          type="button"
          onClick={() => setTab("staff")}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מאמן / אדמין
        </button>
        <button
          type="button"
          onClick={() => setTab("student")}
          className={`rounded-md py-1.5 font-medium transition-colors ${
            tab === "student" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          מתאמן
        </button>
      </div>
      {tab === "staff" ? <StaffLoginForm /> : <StudentLoginForm />}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 bg-brand-gradient">
      <Card className="w-full max-w-md bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-4 left-4 flex gap-1.5 opacity-70">
          <span className="block w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span className="block w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="block w-2.5 h-2.5 rounded-full bg-emerald-500" />
        </div>
        <CardContent className="flex flex-col gap-6 p-8 pt-12">
          <div className="text-center flex flex-col gap-2">
            <div className="flex flex-col items-center gap-3">
              <Image
                src="/logo.png"
                alt="לוגו אקדמיית סנוקר"
                width={120}
                height={75}
                className="object-contain"
              />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                אקדמיית סנוקר
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              ניהול אימונים, נוכחות ומאמנים
            </p>
          </div>
          <Suspense>
            <LoginTabs />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(login): add student OTP tab"
```

---

### Task 9: Student nav + layout

**Files:**
- Modify: `src/components/nav-items.ts`
- Create: `src/app/(student)/layout.tsx`

- [ ] **Step 1: Add STUDENT_NAV to nav-items.ts**

Append to the end of `src/components/nav-items.ts`:

```typescript
export const STUDENT_NAV: NavItem[] = [
  { href: "/student", label: "האימונים שלי", icon: "Calendar" },
  { href: "/student/history", label: "היסטוריה", icon: "History" },
  { href: "/student/contact", label: "פנייה לאדמין", icon: "MessageSquare" },
];
```

- [ ] **Step 2: Create student layout**

Create `src/app/(student)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { STUDENT_NAV } from "@/components/nav-items";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getUserRole(user.email!);
  if (role !== "student") redirect("/denied");
  return <AppShell items={STUDENT_NAV}>{children}</AppShell>;
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-items.ts src/app/(student)/layout.tsx
git commit -m "feat(student): add nav items and layout"
```

---

### Task 10: Student dashboard page (upcoming sessions)

**Files:**
- Create: `src/app/(student)/student/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(student)/student/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchSessionsForStudent } from "@/lib/sheets/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  private: "אישי",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const today = new Date().toISOString().slice(0, 10);
  const allSessions = await fetchSessionsForStudent(student.id);
  const upcoming = allSessions.filter((s) => s.date >= today && s.status !== "cancelled");

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">שלום, {student.first_name}</h1>
      <p className="text-muted-foreground mb-6">האימונים הקרובים שלך</p>

      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין אימונים מתוכננים כרגע</p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{formatDate(s.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.start_time} – {s.end_time}
                    {s.address ? ` · ${s.address}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">{TYPE_LABELS[s.training_type] ?? s.training_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(student)/student/page.tsx"
git commit -m "feat(student): add upcoming sessions dashboard"
```

---

### Task 11: Student history page

**Files:**
- Create: `src/app/(student)/student/history/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(student)/student/history/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";
import { fetchSessionsAll } from "@/lib/sheets/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/sheets/schemas";

const TYPE_LABELS: Record<string, string> = {
  private: "אישי",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function StudentHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const [attendance, allSessions] = await Promise.all([
    fetchAttendanceForStudent(student.id),
    fetchSessionsAll(),
  ]);

  const presentIds = new Set(
    attendance.filter((a) => a.status === "present").map((a) => a.session_id),
  );
  const sessionMap = new Map<string, Session>(allSessions.map((s) => [s.id, s]));

  const history = [...presentIds]
    .map((id) => sessionMap.get(id))
    .filter((s): s is Session => s !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">היסטוריית אימונים</h1>
      <p className="text-muted-foreground mb-6">אימונים שנכחת בהם</p>

      {history.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין היסטוריית אימונים עדיין</p>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{formatDate(s.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.start_time} – {s.end_time}
                  </p>
                </div>
                <Badge variant="secondary">{TYPE_LABELS[s.training_type] ?? s.training_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(student)/student/history/page.tsx"
git commit -m "feat(student): add attendance history page"
```

---

### Task 12: Student contact page + API route

**Files:**
- Create: `src/app/api/student/contact/route.ts`
- Create: `src/components/student-contact-form.tsx`
- Create: `src/app/(student)/student/contact/page.tsx`

- [ ] **Step 1: Create the API route**

Create `src/app/api/student/contact/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { insertContactRequest } from "@/lib/sheets/contact";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const student = await getStudentByEmail(user.email!);
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 403 });

    const { subject, message } = await req.json() as { subject: string; message: string };
    if (!subject || !message?.trim()) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await insertContactRequest({ student_id: student.id, subject, message });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the contact form client component**

Create `src/components/student-contact-form.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SUBJECTS = [
  { value: "שאלה כללית", label: "שאלה כללית" },
  { value: "בעיה טכנית", label: "בעיה טכנית" },
  { value: "אחר", label: "אחר" },
];

export function StudentContactForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject || !message.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/student/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) throw new Error();
      toast.success("הפנייה נשלחה בהצלחה");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("שגיאה בשליחת הפנייה, נסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">נושא</label>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger>
            <SelectValue placeholder="בחר נושא" />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">הודעה</label>
        <Textarea
          placeholder="כתוב את הפנייה שלך כאן..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
        />
      </div>

      <Button type="submit" disabled={loading || !subject || !message.trim()}>
        {loading ? "שולח..." : "שלח פנייה"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create the contact page**

Create `src/app/(student)/student/contact/page.tsx`:

```typescript
import { StudentContactForm } from "@/components/student-contact-form";

export default function StudentContactPage() {
  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">פנייה לאדמין</h1>
      <p className="text-muted-foreground mb-6">שלח שאלה או הודעה לצוות האקדמיה</p>
      <StudentContactForm />
    </div>
  );
}
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/student/contact/route.ts src/components/student-contact-form.tsx "src/app/(student)/student/contact/page.tsx"
git commit -m "feat(student): add contact admin form and API route"
```

---

### Task 13: Admin messages page + badge

**Files:**
- Create: `src/app/api/admin/messages/route.ts`
- Create: `src/components/admin-messages.tsx`
- Create: `src/app/(admin)/admin/messages/page.tsx`
- Modify: `src/components/nav-items.ts`
- Modify: `src/app/api/admin/stats/route.ts`
- Modify: `src/components/admin-dashboard.tsx`

- [ ] **Step 1: Create admin messages API route**

Create `src/app/api/admin/messages/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchContactRequests, markContactRequestRead } from "@/lib/sheets/contact";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const requests = await fetchContactRequests();
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await req.json() as { id: string };
    await markContactRequestRead(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

> **Note:** Check how `requireUser` is implemented in `src/lib/auth/requireUser.ts` — it returns an object with a `role` field. If the file doesn't exist yet, look at how other admin API routes authenticate (e.g., `src/app/api/admin/stats/route.ts` uses `requireUser`).

- [ ] **Step 2: Create admin messages client component**

Create `src/components/admin-messages.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactRequest } from "@/lib/sheets/contact";

async function fetchMessages(): Promise<ContactRequest[]> {
  const res = await fetch("/api/admin/messages");
  const data = await res.json() as { requests: ContactRequest[] };
  return data.requests;
}

async function markRead(id: string): Promise<void> {
  await fetch("/api/admin/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export function AdminMessages() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: fetchMessages,
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  function handleExpand(id: string, status: string) {
    setExpanded(expanded === id ? null : id);
    if (status === "new") markAsRead(id);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return <p className="text-muted-foreground text-center py-12">אין פניות עדיין</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <Card
          key={m.id}
          className="cursor-pointer"
          onClick={() => handleExpand(m.id, m.status)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{m.subject}</span>
                  {m.status === "new" && <Badge className="text-xs">חדש</Badge>}
                </div>
                <p
                  className={`text-sm text-muted-foreground ${
                    expanded === m.id ? "" : "truncate"
                  }`}
                >
                  {m.message}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(m.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create admin messages page**

Create `src/app/(admin)/admin/messages/page.tsx`:

```typescript
import { AdminMessages } from "@/components/admin-messages";

export default function AdminMessagesPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">פניות מתאמנים</h1>
      <p className="text-muted-foreground mb-6">הודעות שנשלחו מהאזור האישי</p>
      <AdminMessages />
    </div>
  );
}
```

- [ ] **Step 4: Add messages to ADMIN_NAV in nav-items.ts**

In `src/components/nav-items.ts`, replace the `ADMIN_NAV` array with:

```typescript
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/students", label: "מתאמנים", icon: "GraduationCap" },
  { href: "/admin/groups", label: "קבוצות", icon: "UsersRound" },
  { href: "/admin/messages", label: "פניות", icon: "MessageSquare" },
  { href: "/admin/guidelines", label: "שליפים למאמן", icon: "FolderOpen" },
  { href: "/admin/pricing", label: "מחירון", icon: "Tag" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

- [ ] **Step 5: Add newMessages to stats route**

In `src/app/api/admin/stats/route.ts`:

Add import at the top (after the existing imports):
```typescript
import { countNewContactRequests } from "@/lib/sheets/contact";
```

Add `newMessages: number` to the `AdminStats` type (line 27, after `sessionsByType`):
```typescript
export type AdminStats = {
  today: string;
  students: { total: number; active: number };
  coaches: { total: number; active: number };
  groups: number;
  weekSessionCount: number;
  todaySessions: Session[];
  upcomingSessions: Session[];
  coachMap: Record<string, string>;
  alerts: { noCoach: Session[] };
  sessionsByDay: DayBar[];
  sessionsByType: TypeSlice[];
  newMessages: number;
};
```

In the `Promise.all` on line 38, add `countNewContactRequests()` as a fifth element:
```typescript
const [students, sessions, groups, coachRows, newMessages] = await Promise.all([
  fetchStudents(),
  fetchSessionsAll(),
  fetchGroupsAll(),
  db.from("coaches").select("email, name, active"),
  countNewContactRequests(),
]);
```

Add `newMessages` to the returned `stats` object (just before the closing `}`):
```typescript
const stats: AdminStats = {
  // ...all existing fields...
  newMessages,
};
```

- [ ] **Step 6: Add messages stat card to admin dashboard**

In `src/components/admin-dashboard.tsx`, add `MessageSquare` to the lucide-react imports:
```typescript
import {
  Users,
  User,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  Layers,
  MessageSquare,
} from "lucide-react";
```

In the stat cards grid (around line 64), add a fifth card after the existing four:
```typescript
<StatCard
  icon={<MessageSquare size={20} />}
  label="פניות חדשות"
  value={data?.newMessages}
  color="rose"
  href="/admin/messages"
  isLoading={isLoading}
/>
```

Also update the grid from `md:grid-cols-4` to `md:grid-cols-5` (line 64):
```typescript
<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
```

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/app/api/admin/messages/route.ts src/components/admin-messages.tsx "src/app/(admin)/admin/messages/page.tsx" src/components/nav-items.ts src/app/api/admin/stats/route.ts src/components/admin-dashboard.tsx
git commit -m "feat(admin): add student messages page and unread badge"
```

---

### Task 14: Run all tests + smoke test

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass including the 6 new resolveRole tests

- [ ] **Step 2: Manual smoke test**

```
1. Run: npm run dev
2. Open http://localhost:3000/login
3. Verify two tabs: "מאמן / אדמין" and "מתאמן"
4. Switch to "מתאמן" → enter a student email from the DB → verify code email arrives
5. Enter the 6-digit code → verify redirect to /student
6. /student — verify upcoming sessions for that student
7. /student/history — verify past attended sessions
8. /student/contact — submit a form → verify success toast
9. Log in as admin → verify "פניות" in sidebar nav
10. /admin/messages — verify the submitted message appears, click to expand and mark as read
11. Admin dashboard stat cards — verify "פניות חדשות" card shows count
```
