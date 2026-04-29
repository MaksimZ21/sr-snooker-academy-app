# Snooker Academy Management App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Hebrew RTL PWA for snooker academy management with Google OAuth (via Supabase Auth), Google Sheets data layer (via service account), and Vercel hosting.

**Architecture:** Next.js 15 App Router on Vercel. Supabase Auth for Google sign-in. Server-side Route Handlers wrap `googleapis` SDK against a service-account-shared Sheets workbook. shadcn/ui + Tailwind for RTL UI. TanStack Query polls reads; writes use optimistic updates and `revalidateTag` invalidation.

**Tech Stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Supabase Auth (`@supabase/ssr`), `googleapis`, TanStack Query, Zod, serwist (PWA), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-29-snooker-academy-design.md`

---

## Task list

- Phase 0 — Project bootstrap: Tasks 1–5
- Phase 1 — Auth & roles: Tasks 6–10
- Phase 2 — Sheets data layer: Tasks 11–15
- Phase 3 — Layout & shared UI: Tasks 16–18
- Phase 4 — Coach experience: Tasks 19–25
- Phase 5 — Admin experience: Tasks 26–28
- Phase 6 — PWA & polish: Tasks 29–31
- Phase 7 — Deployment: Tasks 32–34

---

## Phase 0 — Project bootstrap

### Task 1: Initialize git and Next.js project

**Files:**
- Create: project root files via `create-next-app`
- Create: `.gitignore`, `README.md`

- [ ] **Step 1: Initialize git in project root**

Run:
```bash
cd /c/1projects/snooker
git init
git add "אפליקציית ניהול אקדמיה - גרסה 1.txt" docs/
git commit -m "chore: import source spec and design doc"
```

- [ ] **Step 2: Scaffold Next.js into the current directory**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --no-turbopack --use-npm
```

When prompted "directory not empty", choose to proceed (the spec + docs are untracked from create-next-app's view but already in git).

- [ ] **Step 3: Verify dev server starts**

Run:
```bash
npm run dev
```

Expected: dev server starts on port 3000. Stop it with Ctrl-C.

- [ ] **Step 4: Commit scaffold**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 with TypeScript and Tailwind"
```

---

### Task 2: Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install auth, data, validation, and state libs**

```bash
npm install @supabase/ssr @supabase/supabase-js googleapis @tanstack/react-query zod date-fns date-fns-tz
```

- [ ] **Step 2: Install dev/test deps**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test msw
```

- [ ] **Step 3: Install PWA tooling**

```bash
npm install -D @serwist/next serwist
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add runtime and dev dependencies"
```

---

### Task 3: Initialize shadcn/ui and add base components

**Files:**
- Create: `components.json`
- Create: `src/components/ui/*`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init -d
```

Choose: New York style, Slate base color, CSS variables yes.

- [ ] **Step 2: Add components used throughout the app**

```bash
npx shadcn@latest add button card tabs dialog sheet toast input label form select dropdown-menu badge skeleton avatar separator
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui components"
```

---

### Task 4: Configure RTL, Hebrew font, and Tailwind logical properties

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `src/app/layout.tsx` with the RTL Hebrew shell**

```tsx
import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "אקדמיית סנוקר",
  description: "אפליקציית ניהול אקדמיה",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${heebo.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `src/app/providers.tsx`**

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Update `src/app/globals.css` to set the Heebo font as default**

Add after the existing Tailwind directives:

```css
@layer base {
  :root {
    --font-sans: var(--font-heebo);
  }
  body { font-family: var(--font-sans); }
}
```

- [ ] **Step 4: Verify dev server still renders**

```bash
npm run dev
```

Open http://localhost:3000 — page renders with `<html dir="rtl" lang="he">`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: RTL Hebrew shell with Heebo font and TanStack Query provider"
```

---

### Task 5: Set up Vitest with React Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add npm script**

In `package.json` `scripts`, add:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Write a smoke test `src/test/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

- [ ] **Step 5: Run it**

```bash
npm run test:run
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: configure Vitest with jsdom and RTL"
```

---

## Phase 1 — Auth & roles

### Task 6: Configure Supabase clients (browser + server)

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEET_ID=
GOOGLE_SHEET_ID_TEST=
ADMIN_EMAILS=
```

- [ ] **Step 2: Create `src/lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Supabase browser and server clients"
```

---

### Task 7: Implement `resolveRole` with tests (TDD)

**Files:**
- Create: `src/lib/auth/resolveRole.ts`
- Create: `src/lib/auth/resolveRole.test.ts`

- [ ] **Step 1: Write failing test `src/lib/auth/resolveRole.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { resolveRole } from "./resolveRole";

describe("resolveRole", () => {
  it("returns admin when email is in ADMIN_EMAILS", () => {
    const r = resolveRole({
      email: "owner@academy.com",
      adminEmails: "owner@academy.com,boss@academy.com",
      activeCoachEmails: [],
    });
    expect(r).toBe("admin");
  });

  it("returns coach when email is in active coach list", () => {
    const r = resolveRole({
      email: "coach1@academy.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("coach");
  });

  it("returns denied when email is not in either list", () => {
    const r = resolveRole({
      email: "rando@example.com",
      adminEmails: "owner@academy.com",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("denied");
  });

  it("admin wins over coach (same email in both lists)", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: "boss@academy.com",
      activeCoachEmails: ["boss@academy.com"],
    });
    expect(r).toBe("admin");
  });

  it("is case-insensitive on email", () => {
    const r = resolveRole({
      email: "Coach1@Academy.com",
      adminEmails: "",
      activeCoachEmails: ["coach1@academy.com"],
    });
    expect(r).toBe("coach");
  });

  it("trims whitespace in ADMIN_EMAILS csv", () => {
    const r = resolveRole({
      email: "boss@academy.com",
      adminEmails: " boss@academy.com , owner@academy.com ",
      activeCoachEmails: [],
    });
    expect(r).toBe("admin");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm run test:run -- resolveRole
```

Expected: fail (`resolveRole` not defined).

- [ ] **Step 3: Implement `src/lib/auth/resolveRole.ts`**

```ts
export type Role = "admin" | "coach" | "denied";

export function resolveRole(input: {
  email: string;
  adminEmails: string;
  activeCoachEmails: string[];
}): Role {
  const email = input.email.trim().toLowerCase();
  const admins = input.adminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (admins.includes(email)) return "admin";
  const coaches = input.activeCoachEmails.map((e) => e.trim().toLowerCase());
  if (coaches.includes(email)) return "coach";
  return "denied";
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm run test:run -- resolveRole
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): role resolver with TDD"
```

---

### Task 8: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/coach", "/admin"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          ),
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/callback).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(auth): middleware redirects unauthed users to /login"
```

---

### Task 9: Login page and OAuth callback

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/page.tsx` (replace default landing)

- [ ] **Step 1: Create `src/app/login/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">אקדמיית סנוקר</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-muted-foreground">היכנס באמצעות חשבון Google</p>
          <Button onClick={signIn} disabled={loading} className="w-full">
            {loading ? "מתחבר..." : "התחברות עם Google"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", req.url));
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with role-aware landing**

```tsx
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
  redirect("/denied");
}
```

- [ ] **Step 4: Create `src/app/denied/page.tsx`**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DeniedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen grid place-items-center p-4 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">אין הרשאה</h1>
        <p className="text-muted-foreground mb-4">
          המשתמש <span className="font-mono">{user?.email}</span> אינו מורשה. פנה למנהל האקדמיה.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): login, OAuth callback, role-aware landing, denied page"
```

---

### Task 10: `getUserRole` helper using Supabase + Sheets

**Files:**
- Create: `src/lib/auth/getUserRole.ts`
- Create: `src/lib/auth/getUserRole.test.ts`

- [ ] **Step 1: Write failing test `src/lib/auth/getUserRole.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets/coaches", () => ({
  fetchActiveCoachEmails: vi.fn(),
}));

import { getUserRole } from "./getUserRole";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

const mockFetch = fetchActiveCoachEmails as unknown as ReturnType<typeof vi.fn>;

describe("getUserRole", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "boss@academy.com";
    mockFetch.mockReset();
  });

  it("returns admin without hitting Sheets when email matches ADMIN_EMAILS", async () => {
    mockFetch.mockResolvedValue([]);
    const r = await getUserRole("boss@academy.com");
    expect(r).toBe("admin");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns coach when email is in Coaches sheet", async () => {
    mockFetch.mockResolvedValue(["c@academy.com"]);
    const r = await getUserRole("c@academy.com");
    expect(r).toBe("coach");
  });

  it("returns denied otherwise", async () => {
    mockFetch.mockResolvedValue(["c@academy.com"]);
    const r = await getUserRole("rando@example.com");
    expect(r).toBe("denied");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm run test:run -- getUserRole
```

- [ ] **Step 3: Implement `src/lib/auth/getUserRole.ts`**

```ts
import { resolveRole, type Role } from "./resolveRole";
import { fetchActiveCoachEmails } from "@/lib/sheets/coaches";

export async function getUserRole(email: string): Promise<Role> {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  const fastAdmin = resolveRole({ email, adminEmails, activeCoachEmails: [] });
  if (fastAdmin === "admin") return "admin";
  const activeCoachEmails = await fetchActiveCoachEmails();
  return resolveRole({ email, adminEmails, activeCoachEmails });
}
```

This depends on `fetchActiveCoachEmails` from Task 11.

- [ ] **Step 4: Commit (test still fails until Task 11 lands)**

```bash
git add -A
git commit -m "feat(auth): getUserRole composes resolveRole with Sheets lookup"
```

---

## Phase 2 — Sheets data layer

### Task 11: Google service-account client + Coaches reader

**Files:**
- Create: `src/lib/google/sheets.ts`
- Create: `src/lib/sheets/coaches.ts`
- Create: `src/lib/sheets/coaches.test.ts`

- [ ] **Step 1: Create `src/lib/google/sheets.ts`**

```ts
import { google } from "googleapis";

let cached: ReturnType<typeof google.sheets> | null = null;

export function getSheetsClient() {
  if (cached) return cached;
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  cached = google.sheets({ version: "v4", auth });
  return cached;
}

export function getDriveClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

export function getSheetId(): string {
  return process.env.GOOGLE_SHEET_ID!;
}
```

- [ ] **Step 2: Write failing test `src/lib/sheets/coaches.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/google/sheets", () => ({
  getSheetsClient: () => ({
    spreadsheets: {
      values: {
        get: vi.fn().mockResolvedValue({
          data: {
            values: [
              ["email", "name", "phone", "active"],
              ["c1@a.com", "Coach 1", "050", "TRUE"],
              ["c2@a.com", "Coach 2", "", "FALSE"],
              ["c3@a.com", "Coach 3", "051", "TRUE"],
            ],
          },
        }),
      },
    },
  }),
  getSheetId: () => "test-sheet",
}));

import { fetchActiveCoachEmails, parseCoachesSheet } from "./coaches";

describe("parseCoachesSheet", () => {
  it("filters to only active coaches and returns lowercased emails", () => {
    const rows = [
      ["email", "name", "phone", "active"],
      ["C1@A.com", "x", "", "TRUE"],
      ["c2@a.com", "y", "", "false"],
      ["c3@a.com", "z", "", "TRUE"],
    ];
    expect(parseCoachesSheet(rows)).toEqual(["c1@a.com", "c3@a.com"]);
  });

  it("returns empty when only header is present", () => {
    expect(parseCoachesSheet([["email", "name", "phone", "active"]])).toEqual([]);
  });
});

describe("fetchActiveCoachEmails", () => {
  it("returns active emails from the sheet", async () => {
    const r = await fetchActiveCoachEmails();
    expect(r).toEqual(["c1@a.com", "c3@a.com"]);
  });
});
```

- [ ] **Step 3: Implement `src/lib/sheets/coaches.ts`**

```ts
import { unstable_cache } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

export function parseCoachesSheet(rows: string[][]): string[] {
  const [, ...data] = rows;
  return data
    .filter((r) => (r[3] ?? "").trim().toUpperCase() === "TRUE")
    .map((r) => (r[0] ?? "").trim().toLowerCase())
    .filter(Boolean);
}

async function readActiveCoachEmails(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: "Coaches!A:D",
  });
  return parseCoachesSheet((res.data.values as string[][]) ?? []);
}

export const fetchActiveCoachEmails = unstable_cache(
  readActiveCoachEmails,
  ["coaches:active"],
  { revalidate: 60, tags: ["coaches"] },
);
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected: all auth + coaches tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sheets): service-account client and Coaches reader"
```

---

### Task 12: Zod schemas for all sheets

**Files:**
- Create: `src/lib/sheets/schemas.ts`
- Create: `src/lib/sheets/schemas.test.ts`

- [ ] **Step 1: Write failing test `src/lib/sheets/schemas.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  StudentRow,
  SessionRow,
  AttendanceRow,
  NoteRow,
  GuidelineRow,
  PricingRow,
  parseRows,
} from "./schemas";

describe("parseRows + Student", () => {
  it("parses Students rows by header", () => {
    const rows = [
      ["id", "name", "phone", "parent_name", "parent_phone", "general_notes", "active"],
      ["S1", "Eli", "050", "Dan", "051", "", "TRUE"],
    ];
    const r = parseRows(rows, StudentRow);
    expect(r).toEqual([
      {
        id: "S1",
        name: "Eli",
        phone: "050",
        parent_name: "Dan",
        parent_phone: "051",
        general_notes: "",
        active: true,
      },
    ]);
  });
});

describe("Session csv student_ids", () => {
  it("splits comma-separated student_ids", () => {
    const rows = [
      ["id","date","start_time","end_time","coach_email","training_type","student_ids","drive_folder_url","status"],
      ["SES1","2026-04-29","17:00","18:00","c@a.com","private","S1, S2,S3","","scheduled"],
    ];
    const r = parseRows(rows, SessionRow);
    expect(r[0].student_ids).toEqual(["S1", "S2", "S3"]);
  });
});

describe("Attendance/Note/Guideline/Pricing", () => {
  it("compiles", () => {
    expect(AttendanceRow).toBeDefined();
    expect(NoteRow).toBeDefined();
    expect(GuidelineRow).toBeDefined();
    expect(PricingRow).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm run test:run -- schemas
```

- [ ] **Step 3: Implement `src/lib/sheets/schemas.ts`**

```ts
import { z } from "zod";

const Bool = z.preprocess(
  (v) => String(v ?? "").trim().toUpperCase() === "TRUE",
  z.boolean(),
);

const Csv = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  z.array(z.string()),
);

export const StudentRow = z.object({
  id: z.string().min(1),
  name: z.string(),
  phone: z.string().default(""),
  parent_name: z.string().default(""),
  parent_phone: z.string().default(""),
  general_notes: z.string().default(""),
  active: Bool,
});
export type Student = z.infer<typeof StudentRow>;

export const TrainingType = z.enum([
  "private",
  "group",
  "beginners",
  "advanced",
  "technique",
  "match-play",
]);

export const SessionRow = z.object({
  id: z.string().min(1),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  coach_email: z.string().email(),
  training_type: TrainingType,
  student_ids: Csv,
  drive_folder_url: z.string().default(""),
  status: z.enum(["scheduled", "completed", "cancelled"]),
});
export type Session = z.infer<typeof SessionRow>;

export const AttendanceRow = z.object({
  session_id: z.string(),
  student_id: z.string(),
  status: z.enum(["present", "absent", "late"]),
  marked_by: z.string().email(),
  marked_at: z.string(),
});
export type Attendance = z.infer<typeof AttendanceRow>;

export const NoteRow = z.object({
  id: z.string(),
  student_id: z.string(),
  session_id: z.string(),
  coach_email: z.string().email(),
  text: z.string(),
  created_at: z.string(),
});
export type Note = z.infer<typeof NoteRow>;

export const GuidelineRow = z.object({
  id: z.string(),
  category: z.string(),
  order: z.coerce.number().int(),
  training_type: z.string().default(""),
  title: z.string(),
  body_or_link: z.string(),
});
export type Guideline = z.infer<typeof GuidelineRow>;

export const PricingRow = z.object({
  lesson_type: z.string(),
  duration_min: z.coerce.number().int(),
  price_nis: z.coerce.number().int(),
  notes: z.string().default(""),
});
export type Pricing = z.infer<typeof PricingRow>;

export function parseRows<T extends z.ZodTypeAny>(
  rows: string[][],
  schema: T,
): z.infer<T>[] {
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((col, i) => (obj[col] = r[i] ?? ""));
    return schema.parse(obj);
  });
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm run test:run -- schemas
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sheets): Zod schemas for all sheets"
```

---

### Task 13: Generic sheet reader + per-table fetchers

**Files:**
- Create: `src/lib/sheets/read.ts`
- Create: `src/lib/sheets/students.ts`
- Create: `src/lib/sheets/sessions.ts`
- Create: `src/lib/sheets/attendance.ts`
- Create: `src/lib/sheets/notes.ts`
- Create: `src/lib/sheets/guidelines.ts`
- Create: `src/lib/sheets/pricing.ts`

- [ ] **Step 1: Create `src/lib/sheets/read.ts`**

```ts
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

export async function readSheet(range: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range,
  });
  return (res.data.values as string[][]) ?? [];
}
```

- [ ] **Step 2: Create `src/lib/sheets/students.ts`**

```ts
import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, StudentRow, type Student } from "./schemas";

export const fetchStudents = unstable_cache(
  async (): Promise<Student[]> => parseRows(await readSheet("Students!A:G"), StudentRow),
  ["students:all"],
  { revalidate: 300, tags: ["students"] },
);
```

- [ ] **Step 3: Create `src/lib/sheets/sessions.ts`**

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { readSheet } from "./read";
import { parseRows, SessionRow, type Session } from "./schemas";

const ALL_RANGE = "Sessions!A:I";

async function readAll(): Promise<Session[]> {
  return parseRows(await readSheet(ALL_RANGE), SessionRow);
}

export const fetchSessionsAll = unstable_cache(readAll, ["sessions:all"], {
  revalidate: 60,
  tags: ["sessions:week"],
});

export async function fetchSessionsForCoachToday(email: string, todayIso: string) {
  const all = await fetchSessionsAll();
  return all.filter((s) => s.coach_email === email && s.date === todayIso);
}

export async function fetchSessionsForCoachWeek(
  email: string,
  startIso: string,
  endIso: string,
) {
  const all = await fetchSessionsAll();
  return all.filter(
    (s) => s.coach_email === email && s.date >= startIso && s.date <= endIso,
  );
}

export async function fetchSessionsTodayAll(todayIso: string) {
  const all = await fetchSessionsAll();
  return all.filter((s) => s.date === todayIso);
}

export async function fetchSessionById(id: string) {
  const all = await fetchSessionsAll();
  return all.find((s) => s.id === id) ?? null;
}

export function invalidateSessions() {
  revalidateTag("sessions:week");
  revalidateTag("sessions:today");
}
```

- [ ] **Step 4: Create `src/lib/sheets/attendance.ts`**

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";
import { readSheet } from "./read";
import { parseRows, AttendanceRow, type Attendance } from "./schemas";

const RANGE = "Attendance!A:E";

async function readAll(): Promise<Attendance[]> {
  return parseRows(await readSheet(RANGE), AttendanceRow);
}

export const fetchAttendanceAll = unstable_cache(readAll, ["attendance:all"], {
  revalidate: 30,
  tags: ["attendance:all"],
});

export async function fetchAttendanceForSession(sessionId: string) {
  return (await fetchAttendanceAll()).filter((a) => a.session_id === sessionId);
}

export async function appendAttendance(row: Attendance) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.session_id, row.student_id, row.status, row.marked_by, row.marked_at],
      ],
    },
  });
  revalidateTag("attendance:all");
  revalidateTag(`attendance:${row.session_id}`);
}

export async function upsertAttendance(row: Attendance) {
  const sheets = getSheetsClient();
  const all = await readAll();
  const idx = all.findIndex(
    (a) => a.session_id === row.session_id && a.student_id === row.student_id,
  );
  if (idx === -1) {
    await appendAttendance(row);
    return;
  }
  const sheetRow = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSheetId(),
    range: `Attendance!A${sheetRow}:E${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.session_id, row.student_id, row.status, row.marked_by, row.marked_at],
      ],
    },
  });
  revalidateTag("attendance:all");
  revalidateTag(`attendance:${row.session_id}`);
}
```

- [ ] **Step 5: Create `src/lib/sheets/notes.ts`**

```ts
import { unstable_cache, revalidateTag } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";
import { readSheet } from "./read";
import { parseRows, NoteRow, type Note } from "./schemas";

const RANGE = "Notes!A:F";

async function readAll(): Promise<Note[]> {
  return parseRows(await readSheet(RANGE), NoteRow);
}

export const fetchNotesAll = unstable_cache(readAll, ["notes:all"], {
  revalidate: 30,
  tags: ["notes:all"],
});

export async function fetchNotesForStudent(studentId: string) {
  return (await fetchNotesAll())
    .filter((n) => n.student_id === studentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function appendNote(row: Note) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [row.id, row.student_id, row.session_id, row.coach_email, row.text, row.created_at],
      ],
    },
  });
  revalidateTag("notes:all");
  revalidateTag(`notes:${row.student_id}`);
}
```

- [ ] **Step 6: Create `src/lib/sheets/guidelines.ts`**

```ts
import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, GuidelineRow, type Guideline } from "./schemas";

export const fetchGuidelines = unstable_cache(
  async (): Promise<Guideline[]> => parseRows(await readSheet("Guidelines!A:F"), GuidelineRow),
  ["guidelines:all"],
  { revalidate: 300, tags: ["guidelines"] },
);
```

- [ ] **Step 7: Create `src/lib/sheets/pricing.ts`**

```ts
import { unstable_cache } from "next/cache";
import { readSheet } from "./read";
import { parseRows, PricingRow, type Pricing } from "./schemas";

export const fetchPricing = unstable_cache(
  async (): Promise<Pricing[]> => parseRows(await readSheet("Pricing!A:D"), PricingRow),
  ["pricing:all"],
  { revalidate: 300, tags: ["pricing"] },
);
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(sheets): per-table fetchers with caching and invalidation"
```

---

### Task 14: API route handlers — sessions today, week, by id

**Files:**
- Create: `src/lib/auth/requireUser.ts`
- Create: `src/app/api/sessions/today/route.ts`
- Create: `src/app/api/sessions/week/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Create `src/lib/auth/requireUser.ts`**

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "./getUserRole";
import type { Role } from "./resolveRole";

export type AuthedUser = { email: string; role: Role };

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Response("Unauthorized", { status: 401 });
  const role = await getUserRole(user.email);
  if (role === "denied") throw new Response("Forbidden", { status: 403 });
  return { email: user.email, role };
}
```

- [ ] **Step 2: Create `src/app/api/sessions/today/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchSessionsForCoachToday,
  fetchSessionsTodayAll,
} from "@/lib/sheets/sessions";

function todayInTel(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

export async function GET() {
  try {
    const user = await requireUser();
    const today = todayInTel();
    const data =
      user.role === "admin"
        ? await fetchSessionsTodayAll(today)
        : await fetchSessionsForCoachToday(user.email, today);
    return NextResponse.json({ sessions: data, today });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 3: Create `src/app/api/sessions/week/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  fetchSessionsForCoachWeek,
  fetchSessionsAll,
} from "@/lib/sheets/sessions";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const start = req.nextUrl.searchParams.get("start")!;
    const end = req.nextUrl.searchParams.get("end")!;
    const coach = req.nextUrl.searchParams.get("coach");
    let data;
    if (user.role === "admin") {
      const all = await fetchSessionsAll();
      data = all.filter(
        (s) =>
          s.date >= start &&
          s.date <= end &&
          (!coach || s.coach_email === coach),
      );
    } else {
      data = await fetchSessionsForCoachWeek(user.email, start, end);
    }
    return NextResponse.json({ sessions: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 4: Create `src/app/api/sessions/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { fetchAttendanceForSession } from "@/lib/sheets/attendance";
import { fetchStudents } from "@/lib/sheets/students";
import { fetchNotesForStudent } from "@/lib/sheets/notes";

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
    const notesByStudent: Record<string, Awaited<ReturnType<typeof fetchNotesForStudent>>> = {};
    await Promise.all(
      sessionStudents.map(async (s) => {
        notesByStudent[s.id] = await fetchNotesForStudent(s.id);
      }),
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

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): session read endpoints with role/ownership guards"
```

---

### Task 15: API route handlers — attendance + notes writes, drive list, guidelines, pricing

**Files:**
- Create: `src/app/api/sessions/[id]/attendance/route.ts`
- Create: `src/app/api/sessions/[id]/notes/route.ts`
- Create: `src/app/api/sessions/[id]/syllabus/route.ts`
- Create: `src/app/api/guidelines/route.ts`
- Create: `src/app/api/pricing/route.ts`
- Create: `src/lib/google/drive.ts`

- [ ] **Step 1: Create `src/lib/google/drive.ts`**

```ts
import { getDriveClient } from "./sheets";

function folderIdFromUrl(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

export async function listImagesInFolder(url: string) {
  const id = folderIdFromUrl(url);
  if (!id) return [];
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${id}' in parents and trashed = false and mimeType contains 'image/'`,
    fields: "files(id, name, thumbnailLink, webContentLink)",
    pageSize: 200,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    thumbnailUrl: f.thumbnailLink ?? `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
    fullUrl: `https://drive.google.com/uc?id=${f.id}`,
  }));
}
```

- [ ] **Step 2: Create `src/app/api/sessions/[id]/attendance/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { upsertAttendance } from "@/lib/sheets/attendance";
import { z } from "zod";

const Body = z.object({
  student_id: z.string().min(1),
  status: z.enum(["present", "absent", "late"]),
});

export async function POST(
  req: Request,
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
    const body = Body.parse(await req.json());
    if (!session.student_ids.includes(body.student_id)) {
      return new NextResponse("student not in session", { status: 400 });
    }
    await upsertAttendance({
      session_id: id,
      student_id: body.student_id,
      status: body.status,
      marked_by: user.email,
      marked_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 3: Create `src/app/api/sessions/[id]/notes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { appendNote } from "@/lib/sheets/notes";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const Body = z.object({
  student_id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
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
    const body = Body.parse(await req.json());
    if (!session.student_ids.includes(body.student_id)) {
      return new NextResponse("student not in session", { status: 400 });
    }
    const note = {
      id: randomUUID(),
      student_id: body.student_id,
      session_id: id,
      coach_email: user.email,
      text: body.text,
      created_at: new Date().toISOString(),
    };
    await appendNote(note);
    return NextResponse.json({ note });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 4: Create `src/app/api/sessions/[id]/syllabus/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { listImagesInFolder } from "@/lib/google/drive";

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
    if (!session.drive_folder_url) return NextResponse.json({ images: [] });
    const images = await listImagesInFolder(session.drive_folder_url);
    return NextResponse.json({ images });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 5: Create `src/app/api/guidelines/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchGuidelines } from "@/lib/sheets/guidelines";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchGuidelines();
    return NextResponse.json({ guidelines: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 6: Create `src/app/api/pricing/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchPricing } from "@/lib/sheets/pricing";

export async function GET() {
  try {
    await requireUser();
    const data = await fetchPricing();
    return NextResponse.json({ pricing: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): writes for attendance and notes; reads for syllabus/guidelines/pricing"
```

---

## Phase 3 — Layout & shared UI

### Task 16: Date helpers (Asia/Jerusalem, Hebrew formatting)

**Files:**
- Create: `src/lib/date.ts`
- Create: `src/lib/date.test.ts`

- [ ] **Step 1: Write failing test `src/lib/date.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatHebrewDate, weekRangeFor, todayIsoTel } from "./date";

describe("formatHebrewDate", () => {
  it("formats a Gregorian date in Hebrew", () => {
    const r = formatHebrewDate("2026-04-29");
    expect(r).toContain("אפריל");
    expect(r).toContain("2026");
  });
});

describe("weekRangeFor", () => {
  it("returns Sunday..Saturday for a Wednesday", () => {
    const { startIso, endIso } = weekRangeFor("2026-04-29"); // Wed
    expect(startIso).toBe("2026-04-26"); // Sun
    expect(endIso).toBe("2026-05-02");   // Sat
  });
  it("when given Sunday, returns same Sunday", () => {
    const { startIso, endIso } = weekRangeFor("2026-04-26");
    expect(startIso).toBe("2026-04-26");
    expect(endIso).toBe("2026-05-02");
  });
});

describe("todayIsoTel", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayIsoTel()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm run test:run -- date
```

- [ ] **Step 3: Implement `src/lib/date.ts`**

```ts
import { format, parseISO, addDays } from "date-fns";

export function todayIsoTel(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

export function formatHebrewDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(parseISO(iso));
}

export function weekRangeFor(iso: string) {
  const d = parseISO(iso);
  const dow = d.getDay(); // 0=Sun
  const start = addDays(d, -dow);
  const end = addDays(start, 6);
  return {
    startIso: format(start, "yyyy-MM-dd"),
    endIso: format(end, "yyyy-MM-dd"),
  };
}

export function dayLabelHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    timeZone: "Asia/Jerusalem",
  }).format(parseISO(iso));
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm run test:run -- date
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Hebrew date helpers in Asia/Jerusalem"
```

---

### Task 17: Shared layout shell — bottom nav (mobile) + side rail (desktop)

**Files:**
- Create: `src/app/(coach)/layout.tsx`
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/nav-items.ts`

- [ ] **Step 1: Create `src/components/nav-items.ts`**

```ts
export type NavItem = { href: string; label: string; icon: string };

export const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "בית", icon: "Home" },
  { href: "/coach/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/coach/guidelines", label: "הנחיות", icon: "BookOpen" },
  { href: "/coach/pricing", label: "מחירון", icon: "Tag" },
  { href: "/coach/profile", label: "פרופיל", icon: "User" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "בית", icon: "Home" },
  { href: "/admin/schedule", label: "לו״ז", icon: "Calendar" },
  { href: "/admin/coaches", label: "מאמנים", icon: "Users" },
  { href: "/admin/profile", label: "פרופיל", icon: "User" },
];
```

- [ ] **Step 2: Create `src/components/app-shell.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import * as Icons from "lucide-react";
import type { NavItem } from "./nav-items";

export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-56 border-l p-4 flex-col gap-1">
        <div className="font-bold text-lg mb-4">אקדמיית סנוקר</div>
        {items.map((it) => (
          <NavLink key={it.href} item={it} active={pathname === it.href} />
        ))}
      </aside>
      <main className="flex-1 pb-20 md:pb-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-background border-t flex justify-around">
        {items.map((it) => (
          <NavLink key={it.href} item={it} active={pathname === it.href} compact />
        ))}
      </nav>
    </div>
  );
}

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact?: boolean;
}) {
  const Icon = (Icons as Record<string, React.ComponentType<{ size?: number }>>)[item.icon];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded p-2 text-sm",
        compact ? "flex-col flex-1 text-xs justify-center py-3" : "",
        active ? "text-primary font-semibold" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon size={compact ? 22 : 18} />}
      <span>{item.label}</span>
    </Link>
  );
}
```

- [ ] **Step 3: Create `src/app/(coach)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { COACH_NAV } from "@/components/nav-items";

export default async function CoachLayout({
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
  if (role === "denied") redirect("/denied");
  if (role === "admin") redirect("/admin");
  return <AppShell items={COACH_NAV}>{children}</AppShell>;
}
```

- [ ] **Step 4: Create `src/app/(admin)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { ADMIN_NAV } from "@/components/nav-items";

export default async function AdminLayout({
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
  if (role !== "admin") redirect("/coach");
  return <AppShell items={ADMIN_NAV}>{children}</AppShell>;
}
```

- [ ] **Step 5: Install lucide icons**

```bash
npm install lucide-react
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: app shell with mobile bottom nav and desktop side rail"
```

---

### Task 18: Session card and weekly grid components

**Files:**
- Create: `src/components/session-card.tsx`
- Create: `src/components/weekly-grid.tsx`

- [ ] **Step 1: Create `src/components/session-card.tsx`**

```tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate } from "@/lib/date";

const TYPE_LABEL: Record<string, string> = {
  private: "פרטני",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

export function SessionCard({
  session,
  basePath,
}: {
  session: Session;
  basePath: "coach" | "admin";
}) {
  return (
    <Link href={`/${basePath}/sessions/${session.id}`}>
      <Card className="hover:bg-accent/40 transition">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="font-medium">
              {session.start_time}–{session.end_time}
            </div>
            <Badge variant={session.status === "cancelled" ? "secondary" : "default"}>
              {TYPE_LABEL[session.training_type] ?? session.training_type}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">{formatHebrewDate(session.date)}</div>
          <div className="text-sm">{session.student_ids.length} מתאמנים</div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Create `src/components/weekly-grid.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { weekRangeFor, todayIsoTel, dayLabelHe } from "@/lib/date";
import { addDays, format, parseISO } from "date-fns";
import { SessionCard } from "./session-card";
import type { Session } from "@/lib/sheets/schemas";

export function WeeklyGrid({
  basePath,
  coachFilter,
}: {
  basePath: "coach" | "admin";
  coachFilter?: string;
}) {
  const [anchor, setAnchor] = useState(todayIsoTel());
  const { startIso, endIso } = weekRangeFor(anchor);

  const { data, isLoading } = useQuery({
    queryKey: ["sessions:week", startIso, endIso, coachFilter ?? null],
    queryFn: async () => {
      const url = new URL("/api/sessions/week", window.location.origin);
      url.searchParams.set("start", startIso);
      url.searchParams.set("end", endIso);
      if (coachFilter) url.searchParams.set("coach", coachFilter);
      const r = await fetch(url);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[] };
    },
    refetchInterval: basePath === "admin" ? 30_000 : 60_000,
  });

  const days = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(startIso), i), "yyyy-MM-dd"),
  );

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button onClick={() => setAnchor(format(addDays(parseISO(anchor), -7), "yyyy-MM-dd"))}>
          ←
        </Button>
        <Button variant="ghost" onClick={() => setAnchor(todayIsoTel())}>
          היום
        </Button>
        <Button onClick={() => setAnchor(format(addDays(parseISO(anchor), 7), "yyyy-MM-dd"))}>
          →
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((iso) => {
          const ses = (data?.sessions ?? []).filter((s) => s.date === iso);
          return (
            <div key={iso} className="flex flex-col gap-2">
              <div className="font-semibold text-sm">{dayLabelHe(iso)}</div>
              <div className="text-xs text-muted-foreground">
                {iso.slice(8, 10)}.{iso.slice(5, 7)}
              </div>
              {ses.length === 0 && (
                <div className="text-xs text-muted-foreground">—</div>
              )}
              {ses.map((s) => (
                <SessionCard key={s.id} session={s} basePath={basePath} />
              ))}
            </div>
          );
        })}
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">טוען...</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: SessionCard and WeeklyGrid components"
```

---

## Phase 4 — Coach experience

### Task 19: Coach dashboard

**Files:**
- Create: `src/app/(coach)/coach/page.tsx`
- Create: `src/components/dashboard.tsx`

- [ ] **Step 1: Create `src/components/dashboard.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { SessionCard } from "./session-card";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate, todayIsoTel } from "@/lib/date";

export function Dashboard({
  basePath,
  pollMs,
}: {
  basePath: "coach" | "admin";
  pollMs: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["sessions:today"],
    queryFn: async () => {
      const r = await fetch("/api/sessions/today");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { sessions: Session[]; today: string };
    },
    refetchInterval: pollMs,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const sessions = (data?.sessions ?? []).slice().sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  const today = data?.today ?? todayIsoTel();
  const now = new Date();
  const nextIdx = sessions.findIndex((s) => {
    const [hh, mm] = s.start_time.split(":").map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d >= now;
  });
  const next = nextIdx >= 0 ? sessions[nextIdx] : null;
  const previous = nextIdx > 0 ? sessions[nextIdx - 1] : sessions[sessions.length - 1] ?? null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">{formatHebrewDate(today)}</h1>
      <section>
        <h2 className="text-sm text-muted-foreground mb-2">המפגש הבא</h2>
        {next ? <SessionCard session={next} basePath={basePath} /> : (
          <div className="text-sm text-muted-foreground">אין מפגש קרוב</div>
        )}
      </section>
      <section>
        <h2 className="text-sm text-muted-foreground mb-2">המפגש הקודם</h2>
        {previous ? <SessionCard session={previous} basePath={basePath} /> : (
          <div className="text-sm text-muted-foreground">אין מפגש קודם</div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(coach)/coach/page.tsx`**

```tsx
import { Dashboard } from "@/components/dashboard";

export default function CoachHomePage() {
  return <Dashboard basePath="coach" pollMs={60_000} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(coach): dashboard with next/previous session cards"
```

---

### Task 20: Coach weekly schedule

**Files:**
- Create: `src/app/(coach)/coach/schedule/page.tsx`

- [ ] **Step 1: Create page**

```tsx
import { WeeklyGrid } from "@/components/weekly-grid";

export default function CoachSchedulePage() {
  return <WeeklyGrid basePath="coach" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(coach): weekly schedule page"
```

---

### Task 21: Session detail page shell + tabs

**Files:**
- Create: `src/app/(coach)/coach/sessions/[id]/page.tsx`
- Create: `src/components/session-detail.tsx`

- [ ] **Step 1: Create `src/components/session-detail.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { SyllabusPanel } from "./syllabus-panel";
import { GuidelinesPanel } from "./guidelines-panel";
import { formatHebrewDate } from "@/lib/date";

type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
};

export function SessionDetail({
  sessionId,
  readOnly,
}: {
  sessionId: string;
  readOnly: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
    refetchInterval: 30_000,
  });

  if (isLoading || !data) return <div className="p-4">טוען...</div>;
  const { session, students, attendance, notesByStudent } = data;

  return (
    <div className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">
          {session.start_time}–{session.end_time}
        </h1>
        <p className="text-muted-foreground">{formatHebrewDate(session.date)}</p>
      </header>
      <Tabs defaultValue="attendance">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="attendance">נוכחות</TabsTrigger>
          <TabsTrigger value="notes">הערות</TabsTrigger>
          <TabsTrigger value="syllabus">סילבוס</TabsTrigger>
          <TabsTrigger value="guidelines">הנחיות</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendancePanel
            sessionId={sessionId}
            students={students}
            attendance={attendance}
            readOnly={readOnly}
          />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel
            sessionId={sessionId}
            students={students}
            notesByStudent={notesByStudent}
            readOnly={readOnly}
          />
        </TabsContent>
        <TabsContent value="syllabus">
          <SyllabusPanel sessionId={sessionId} />
        </TabsContent>
        <TabsContent value="guidelines">
          <GuidelinesPanel trainingType={session.training_type} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(coach)/coach/sessions/[id]/page.tsx`**

```tsx
import { SessionDetail } from "@/components/session-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetail sessionId={id} readOnly={false} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(coach): session detail page shell with tabs"
```

---

### Task 22: Attendance panel with optimistic writes

**Files:**
- Create: `src/components/attendance-panel.tsx`

- [ ] **Step 1: Create `src/components/attendance-panel.tsx`**

```tsx
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { Attendance, Student } from "@/lib/sheets/schemas";

const STATUSES: { key: Attendance["status"]; label: string }[] = [
  { key: "present", label: "נוכח" },
  { key: "late", label: "איחור" },
  { key: "absent", label: "לא נוכח" },
];

export function AttendancePanel({
  sessionId,
  students,
  attendance,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  attendance: Attendance[];
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (input: { student_id: string; status: Attendance["status"] }) => {
      const r = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error("write failed");
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["session", sessionId] });
      const prev = qc.getQueryData<{ attendance: Attendance[] } & Record<string, unknown>>([
        "session",
        sessionId,
      ]);
      qc.setQueryData(["session", sessionId], (old: typeof prev) => {
        if (!old) return old;
        const filtered = old.attendance.filter((a) => a.student_id !== input.student_id);
        return {
          ...old,
          attendance: [
            ...filtered,
            {
              session_id: sessionId,
              student_id: input.student_id,
              status: input.status,
              marked_by: "you",
              marked_at: new Date().toISOString(),
            },
          ],
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["session", sessionId], ctx.prev);
      toast({ title: "שגיאה בשמירת הנוכחות", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["session", sessionId] }),
  });

  function statusFor(studentId: string) {
    return attendance.find((a) => a.student_id === studentId)?.status;
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {students.map((s) => {
        const cur = statusFor(s.id);
        return (
          <div key={s.id} className="flex justify-between items-center border rounded p-3">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.id}</div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant={cur === st.key ? "default" : "outline"}
                  disabled={readOnly || mut.isPending}
                  onClick={() => mut.mutate({ student_id: s.id, status: st.key })}
                >
                  {st.label}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(coach): attendance panel with optimistic writes"
```

---

### Task 23: Notes panel with history

**Files:**
- Create: `src/components/notes-panel.tsx`

- [ ] **Step 1: Create `src/components/notes-panel.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Note, Student } from "@/lib/sheets/schemas";

export function NotesPanel({
  sessionId,
  students,
  notesByStudent,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  notesByStudent: Record<string, Note[]>;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 mt-4">
      {students.map((s) => (
        <StudentNotes
          key={s.id}
          sessionId={sessionId}
          student={s}
          notes={notesByStudent[s.id] ?? []}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function StudentNotes({
  sessionId,
  student,
  notes,
  readOnly,
}: {
  sessionId: string;
  student: Student;
  notes: Note[];
  readOnly: boolean;
}) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (t: string) => {
      const r = await fetch(`/api/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: student.id, text: t }),
      });
      if (!r.ok) throw new Error("write failed");
      return (await r.json()) as { note: Note };
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: () => toast({ title: "שגיאה בשמירת ההערה", variant: "destructive" }),
  });

  return (
    <div className="border rounded p-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{student.name}</h3>
        <span className="text-xs text-muted-foreground">{notes.length} הערות</span>
      </div>
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="הוסף הערה..."
          />
          <Button
            disabled={!text.trim() || mut.isPending}
            onClick={() => mut.mutate(text.trim())}
            className="self-start"
          >
            שמור
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 mt-2">
        {notes.map((n) => (
          <div key={n.id} className="text-sm border-r-2 pr-3 border-primary/30">
            <p>{n.text}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("he-IL")} · {n.coach_email}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Textarea component**

```bash
npx shadcn@latest add textarea
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(coach): notes panel with per-student history"
```

---

### Task 24: Syllabus + Guidelines panels

**Files:**
- Create: `src/components/syllabus-panel.tsx`
- Create: `src/components/guidelines-panel.tsx`

- [ ] **Step 1: Create `src/components/syllabus-panel.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";

type Image = { id: string; name: string; thumbnailUrl: string; fullUrl: string };

export function SyllabusPanel({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["syllabus", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}/syllabus`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { images: Image[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const images = data?.images ?? [];
  if (images.length === 0)
    return <div className="p-4 text-muted-foreground">אין תמונות עדיין</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
      {images.map((img) => (
        <a key={img.id} href={img.fullUrl} target="_blank" rel="noopener" className="block">
          <img src={img.thumbnailUrl} alt={img.name} className="w-full h-32 object-cover rounded" loading="lazy" />
          <div className="text-xs mt-1 truncate">{img.name}</div>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/guidelines-panel.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import type { Guideline } from "@/lib/sheets/schemas";

export function GuidelinesPanel({ trainingType }: { trainingType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["guidelines"],
    queryFn: async () => {
      const r = await fetch("/api/guidelines");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { guidelines: Guideline[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const filtered = (data?.guidelines ?? []).filter(
    (g) => !g.training_type || g.training_type === trainingType,
  );
  if (filtered.length === 0)
    return <div className="p-4 text-muted-foreground">אין הנחיות לסוג אימון זה</div>;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {filtered
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <div key={g.id} className="border rounded p-3">
            <div className="text-xs text-muted-foreground">{g.category}</div>
            <h3 className="font-semibold">{g.title}</h3>
            {g.body_or_link.startsWith("http") ? (
              <a href={g.body_or_link} target="_blank" rel="noopener" className="text-primary underline text-sm">
                פתח קישור
              </a>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{g.body_or_link}</p>
            )}
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(coach): syllabus and guidelines panels"
```

---

### Task 25: Coach guidelines library, pricing, profile pages

**Files:**
- Create: `src/app/(coach)/coach/guidelines/page.tsx`
- Create: `src/app/(coach)/coach/pricing/page.tsx`
- Create: `src/app/(coach)/coach/profile/page.tsx`
- Create: `src/components/guidelines-library.tsx`
- Create: `src/components/pricing-table.tsx`
- Create: `src/components/profile-card.tsx`

- [ ] **Step 1: Create `src/components/guidelines-library.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import type { Guideline } from "@/lib/sheets/schemas";

export function GuidelinesLibrary() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["guidelines"],
    queryFn: async () => {
      const r = await fetch("/api/guidelines");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { guidelines: Guideline[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const filtered = (data?.guidelines ?? [])
    .filter((g) => g.title.includes(q) || g.category.includes(q))
    .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);
  const grouped: Record<string, Guideline[]> = {};
  filtered.forEach((g) => {
    grouped[g.category] = grouped[g.category] ?? [];
    grouped[g.category].push(g);
  });

  return (
    <div className="p-4 flex flex-col gap-4">
      <Input placeholder="חיפוש..." value={q} onChange={(e) => setQ(e.target.value)} />
      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <h2 className="font-bold mb-2">{cat}</h2>
          <div className="flex flex-col gap-2">
            {items.map((g) => (
              <div key={g.id} className="border rounded p-3">
                <h3 className="font-semibold">{g.title}</h3>
                {g.body_or_link.startsWith("http") ? (
                  <a href={g.body_or_link} target="_blank" rel="noopener" className="text-primary underline text-sm">
                    פתח קישור
                  </a>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{g.body_or_link}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/pricing-table.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import type { Pricing } from "@/lib/sheets/schemas";

export function PricingTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const r = await fetch("/api/pricing");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { pricing: Pricing[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  const rows = data?.pricing ?? [];

  return (
    <div className="p-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-right p-2">סוג שיעור</th>
            <th className="text-right p-2">משך</th>
            <th className="text-right p-2">מחיר (₪)</th>
            <th className="text-right p-2">הערות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{p.lesson_type}</td>
              <td className="p-2">{p.duration_min} דקות</td>
              <td className="p-2">{p.price_nis}</td>
              <td className="p-2 text-sm text-muted-foreground">{p.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/profile-card.tsx`**

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ProfileCard({ email, role }: { email: string; role: string }) {
  async function signOut() {
    const sb = createSupabaseBrowserClient();
    await sb.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>פרופיל</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <div className="text-sm text-muted-foreground">דוא״ל</div>
            <div className="font-mono">{email}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">תפקיד</div>
            <div>{role === "admin" ? "מנהל" : "מאמן"}</div>
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

- [ ] **Step 4: Create the three pages**

`src/app/(coach)/coach/guidelines/page.tsx`:
```tsx
import { GuidelinesLibrary } from "@/components/guidelines-library";
export default function Page() { return <GuidelinesLibrary />; }
```

`src/app/(coach)/coach/pricing/page.tsx`:
```tsx
import { PricingTable } from "@/components/pricing-table";
export default function Page() { return <PricingTable />; }
```

`src/app/(coach)/coach/profile/page.tsx`:
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

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(coach): guidelines library, pricing, and profile pages"
```

---

## Phase 5 — Admin experience

### Task 26: Admin dashboard + schedule (with coach filter)

**Files:**
- Create: `src/app/(admin)/admin/page.tsx`
- Create: `src/app/(admin)/admin/schedule/page.tsx`
- Create: `src/components/admin-schedule.tsx`
- Create: `src/app/api/coaches/route.ts`

- [ ] **Step 1: Create `src/app/api/coaches/route.ts`** (admin-only)

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { unstable_cache } from "next/cache";
import { readSheet } from "@/lib/sheets/read";

const fetchAll = unstable_cache(
  async () => {
    const rows = await readSheet("Coaches!A:D");
    const [, ...data] = rows;
    return data.map((r) => ({
      email: r[0] ?? "",
      name: r[1] ?? "",
      phone: r[2] ?? "",
      active: (r[3] ?? "").toUpperCase() === "TRUE",
    }));
  },
  ["coaches:all"],
  { revalidate: 300, tags: ["coaches"] },
);

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ coaches: await fetchAll() });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
```

- [ ] **Step 2: Create `src/app/(admin)/admin/page.tsx`**

```tsx
import { Dashboard } from "@/components/dashboard";

export default function AdminHomePage() {
  return <Dashboard basePath="admin" pollMs={30_000} />;
}
```

- [ ] **Step 3: Create `src/components/admin-schedule.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WeeklyGrid } from "./weekly-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Coach = { email: string; name: string; active: boolean };

export function AdminSchedule() {
  const [coach, setCoach] = useState<string>("all");
  const { data } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
  });

  return (
    <div>
      <div className="p-4 max-w-xs">
        <Select value={coach} onValueChange={setCoach}>
          <SelectTrigger>
            <SelectValue placeholder="כל המאמנים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המאמנים</SelectItem>
            {(data?.coaches ?? []).filter((c) => c.active).map((c) => (
              <SelectItem key={c.email} value={c.email}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <WeeklyGrid basePath="admin" coachFilter={coach === "all" ? undefined : coach} />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/(admin)/admin/schedule/page.tsx`**

```tsx
import { AdminSchedule } from "@/components/admin-schedule";
export default function Page() { return <AdminSchedule />; }
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): dashboard and schedule with coach filter"
```

---

### Task 27: Admin coaches list

**Files:**
- Create: `src/app/(admin)/admin/coaches/page.tsx`
- Create: `src/components/coaches-list.tsx`

- [ ] **Step 1: Create `src/components/coaches-list.tsx`**

```tsx
"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Coach = { email: string; name: string; phone: string; active: boolean };

export function CoachesList() {
  const { data, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: Coach[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="p-4">טוען...</div>;
  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        עריכת רשימת המאמנים נעשית ישירות ב-Google Sheets.
      </p>
      {(data?.coaches ?? []).map((c) => (
        <Card key={c.email}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-muted-foreground">{c.email}</div>
              {c.phone && <div className="text-sm">{c.phone}</div>}
            </div>
            <Badge variant={c.active ? "default" : "secondary"}>
              {c.active ? "פעיל" : "לא פעיל"}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(admin)/admin/coaches/page.tsx`**

```tsx
import { CoachesList } from "@/components/coaches-list";
export default function Page() { return <CoachesList />; }
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): read-only coaches list"
```

---

### Task 28: Admin session detail (read-only) + admin profile

**Files:**
- Create: `src/app/(admin)/admin/sessions/[id]/page.tsx`
- Create: `src/app/(admin)/admin/profile/page.tsx`

- [ ] **Step 1: Create admin session detail page**

```tsx
import { SessionDetail } from "@/components/session-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetail sessionId={id} readOnly={true} />;
}
```

- [ ] **Step 2: Create admin profile page**

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

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): read-only session detail and profile"
```

---

## Phase 6 — PWA & polish

### Task 29: Service worker via serwist

**Files:**
- Create: `src/app/sw.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `src/app/sw.ts`**

```ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: any[] };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: { entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }] },
});

serwist.addEventListeners();
```

- [ ] **Step 2: Wrap config in `next.config.ts`**

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({ swSrc: "src/app/sw.ts", swDest: "public/sw.js" });

const config: NextConfig = {
  experimental: {},
};

export default withSerwist(config);
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(pwa): serwist service worker setup"
```

---

### Task 30: PWA manifest, icons, offline page

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-192.png`, `public/icon-512.png` (placeholder)
- Create: `src/app/offline/page.tsx`
- Modify: `src/app/layout.tsx` (link manifest)

- [ ] **Step 1: Create `public/manifest.webmanifest`**

```json
{
  "name": "אקדמיית סנוקר",
  "short_name": "אקדמיה",
  "description": "ניהול אקדמיה לסנוקר",
  "start_url": "/",
  "display": "standalone",
  "dir": "rtl",
  "lang": "he",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Add placeholder PNG icons**

Generate solid-color placeholders or hand off to design later. For initial bring-up, use any 192×192 and 512×512 PNG. Engineer note: replace with branded icons before launch.

- [ ] **Step 3: Create `src/app/offline/page.tsx`**

```tsx
export default function Offline() {
  return (
    <main className="min-h-screen grid place-items-center p-4 text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">אין חיבור לאינטרנט</h1>
        <p className="text-muted-foreground">נסה שוב כשהחיבור יחזור.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Add manifest link in `src/app/layout.tsx`**

In the `<Metadata>` constant, add:
```ts
manifest: "/manifest.webmanifest",
themeColor: "#0f172a",
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pwa): manifest, icons, offline fallback"
```

---

### Task 31: E2E happy path test (Playwright)

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/happy-path.spec.ts`

- [ ] **Step 1: Initialize Playwright**

```bash
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Create `e2e/happy-path.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

// Skipped in CI until test sheet + auth bypass is wired.
test.skip("coach marks attendance, admin sees it", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/אקדמיית סנוקר/);
});
```

This is a placeholder happy-path; the engineer will fill the body when test-sheet credentials are configured. Keeping the skeleton so the harness exists.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): Playwright skeleton for happy path"
```

---

## Phase 7 — Deployment

### Task 32: Set up Google Cloud service account + share workbook

**Files:** none (operational steps only — runbook entries)

- [ ] **Step 1: Create a Google Cloud project**

Console: https://console.cloud.google.com → New Project → name "snooker-academy".

- [ ] **Step 2: Enable APIs**

In APIs & Services → enable:
- Google Sheets API
- Google Drive API

- [ ] **Step 3: Create a service account**

IAM & Admin → Service Accounts → Create. Name: "snooker-app-sa". Skip the optional roles step. Create a JSON key — download it.

- [ ] **Step 4: Create the workbook**

Create a Google Sheet with these tabs and headers (from the spec):

- `Coaches`: `email | name | phone | active`
- `Students`: `id | name | phone | parent_name | parent_phone | general_notes | active`
- `Sessions`: `id | date | start_time | end_time | coach_email | training_type | student_ids | drive_folder_url | status`
- `Attendance`: `session_id | student_id | status | marked_by | marked_at`
- `Notes`: `id | student_id | session_id | coach_email | text | created_at`
- `Guidelines`: `id | category | order | training_type | title | body_or_link`
- `Pricing`: `lesson_type | duration_min | price_nis | notes`

- [ ] **Step 5: Share the workbook with the service account email**

Copy the `client_email` from the JSON key (looks like `snooker-app-sa@<project>.iam.gserviceaccount.com`). In the Sheet, Share → Editor, paste that email.

- [ ] **Step 6: Repeat for the test workbook**

Create a second copy named "Snooker Academy — TEST". Same tabs, same sharing.

- [ ] **Step 7: Add a runbook entry to `docs/runbook.md`**

Document the process for adding coaches (edit Coaches sheet, set `active=TRUE`) and creating sessions (append a row to Sessions sheet, paste a Drive folder URL into `drive_folder_url`).

---

### Task 33: Set up Supabase project for auth

**Files:** none (operational)

- [ ] **Step 1: Create a Supabase project**

https://supabase.com/dashboard → New Project. Region near Israel (eu-central-1 or eu-west-3).

- [ ] **Step 2: Enable Google provider**

Authentication → Providers → Google. Set OAuth client ID and secret from a GCP OAuth client (different from the service account — use OAuth 2.0 Client ID, Web application).

- [ ] **Step 3: Configure redirect URL**

Add `https://<your-vercel-domain>/auth/callback` and `http://localhost:3000/auth/callback`.

- [ ] **Step 4: Capture URL + anon key**

Project Settings → API. Save `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

### Task 34: Vercel deploy

**Files:** none (operational); also create `.env.local` for local dev

- [ ] **Step 1: Create local `.env.local`**

Copy `.env.local.example` to `.env.local`, fill in:
- Supabase URL + anon key (from Task 33)
- `GOOGLE_SERVICE_ACCOUNT_JSON` — paste the full JSON, single line, escape inner quotes; OR base64-encode and decode in the client
- `GOOGLE_SHEET_ID` — sheet ID from URL
- `GOOGLE_SHEET_ID_TEST` — test sheet ID
- `ADMIN_EMAILS` — your Gmail

- [ ] **Step 2: Smoke test locally**

```bash
npm run dev
```

Sign in with Google. Should redirect to `/coach` (assuming you added yourself to Coaches sheet) or `/admin` (assuming your email is in `ADMIN_EMAILS`). Today's sessions render.

- [ ] **Step 3: Push to GitHub**

```bash
gh repo create snooker-academy --private --source=. --push
```

- [ ] **Step 4: Import into Vercel**

https://vercel.com/new → import the repo. Set env vars in Project Settings → Environment Variables for both Preview and Production. Use `GOOGLE_SHEET_ID_TEST` for Preview, `GOOGLE_SHEET_ID` for Production.

- [ ] **Step 5: First production deploy**

Push to `main`; Vercel auto-deploys. Visit the assigned `*.vercel.app` URL, sign in, verify role-based redirect and dashboard render.

- [ ] **Step 6: Update Supabase redirect URL**

Add the production URL `https://<project>.vercel.app/auth/callback` to Supabase auth redirect allowlist.

- [ ] **Step 7: Final commit**

```bash
git add docs/runbook.md
git commit -m "docs: operational runbook"
git push
```

---

## Self-review

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| §1 Goals & 11 features | Tasks 9, 19–28 |
| §2 Architecture (Next.js + Supabase + Sheets via SA) | Tasks 1–11 |
| §3 Sheets schema | Task 12 (Zod) + Task 32 (Sheet creation) |
| §4 Routes & RTL | Tasks 4, 17–28 |
| §5 Auth & role resolution | Tasks 6–10, 14 |
| §6 Caching, polling, optimistic writes, errors | Tasks 11, 13, 14, 15, 22, 23 |
| §7 Testing | Tasks 5, 7, 10, 11, 12, 16, 31 |
| §8 Deployment | Tasks 32–34 |
| §9 Open items | Flagged in spec; no plan task — re-confirm with user before launch |
| §10 Glossary | Used inline in Hebrew labels (Tasks 18, 22) |

**Placeholder scan:** No "TBD/TODO/implement later" in code blocks. The PWA icons in Task 30 are an explicit placeholder, called out — not a hidden one.

**Type consistency:** `Session.student_ids: string[]` (CSV-parsed) consistently used across schemas, API, and components. `Role` type imported from `resolveRole` everywhere. Note `Attendance.status` enum (`present`/`absent`/`late`) is the same string in API write body, schema parser, and UI.

**Open considerations to flag during execution:**
- Task 7's `getUserRole` test mocks `@/lib/sheets/coaches`; tests pass after Task 11 lands. Run the full test suite at the end of Phase 2.
- Task 22's optimistic write inserts a placeholder `marked_by: "you"` into the cache; the server response (in `onSettled`'s invalidation) replaces it.
- Task 30's PWA icons are placeholders — flag for branding before public launch.
