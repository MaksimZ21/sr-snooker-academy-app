# Admin Contact-Request Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a student submits a contact request, every admin gets a real OS-level push notification on their phone (PWA), the admin messages list shows who sent each request, and admins can mark a request "טופל" (handled) to separate open work from resolved.

**Architecture:** New `push_subscriptions` table + `web-push` (VAPID) library + a `push` listener in the existing service worker deliver real push notifications. `contact_requests` gains a join to `students` for display and a third `status` value (`handled`). See `docs/superpowers/specs/2026-09-09-admin-contact-notifications-design.md` for the full design and rationale.

**Tech Stack:** Next.js API routes, Supabase (service-role `db` client), `web-push` (VAPID), the existing Serwist service worker, TanStack Query, shadcn/ui `Tabs`.

**Testing note (deviates from the spec's suggestion):** the spec mentions unit tests for `sendPushToAdmins`/`fetchContactRequests` by mocking the `db` client. This codebase has **no existing precedent** for mocking Supabase's fluent query-builder chain (`grep` confirms zero `vi.mock` of `@/lib/db/client` anywhere) — every existing test in this repo covers a pure `-shared.ts`/`-logic.ts` module with zero `db` dependency instead (e.g. `session-pricing-shared.test.ts`, `tournament-logic.test.ts`). Introducing a first-of-its-kind fragile mock of Supabase's chain for this one feature isn't worth it. This plan verifies the db-touching code via `tsc`, careful code review, and a manual end-to-end smoke test (Task 9) instead — consistent with how every other `db`-touching module in this codebase (`fetchTournamentHouses`, `upsertSessionFromCrm`, `fetchCoachSalaryForMonth`, etc.) is actually verified today.

---

### Task 1: Database migration + `web-push` dependency

**Files:**
- Create: `supabase/migrations/20260909_push_subscriptions.sql`
- Modify: `package.json` (via `npm install`)

- [ ] **Step 1: Write the migration**

```sql
-- Web Push subscriptions for admin browser/PWA notifications.
-- One row per (admin email, browser/device) — endpoint is the unique
-- per-device push URL from the browser's push service, so re-subscribing
-- the same device (e.g. after a permission reset) upserts in place rather
-- than accumulating duplicate rows.
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
```

Save this to `supabase/migrations/20260909_push_subscriptions.sql`. This repo's migrations are applied manually by the user via the Supabase SQL Editor (there is no local DB connection in this environment) — do not attempt to run it.

- [ ] **Step 2: Install `web-push`**

Run:
```bash
npm install web-push
npm install -D @types/web-push
```

Expected: both added to `package.json` (`web-push` under `dependencies`, `@types/web-push` under `devDependencies`).

- [ ] **Step 3: Generate VAPID keys and hand them to the user**

Run:
```bash
npx web-push generate-vapid-keys
```

This prints a public and private key pair. These are **not committed to git**. Report the two keys directly to the user in chat and tell them:
1. Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (e.g. `mailto:maksim110044@gmail.com`) to their Vercel project's environment variables.
2. Add the same three to their own local `.env.local` if they run the app locally.
3. Run the SQL migration from Step 1 in the Supabase SQL Editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260909_push_subscriptions.sql package.json package-lock.json
git commit -m "chore: add push_subscriptions table and web-push dependency"
```

---

### Task 2: Push send helper

**Files:**
- Create: `src/lib/push/send.ts`

- [ ] **Step 1: Write the helper**

```ts
import { sendNotification, setVapidDetails } from "web-push";
import { db } from "@/lib/db/client";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID env vars not set — skipping push send");
    return false;
  }
  if (!configured) {
    setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends a Web Push notification to every registered admin device.
 * Never throws — a push failure (missing VAPID config, expired
 * subscription, network error) must never break the caller's own
 * operation (e.g. submitting a contact request).
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;

    const emails = adminEmails();
    if (emails.length === 0) return;

    const { data } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_email", emails);
    const subs = (data ?? []) as SubscriptionRow[];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("[push] send failed", err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] sendPushToAdmins failed", err);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file. (If `web-push` ships no bundled types and `@types/web-push` didn't resolve the `webpush.sendNotification`/`setVapidDetails` signatures, fix the import before moving on — do not proceed with `any`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/send.ts
git commit -m "feat(push): add sendPushToAdmins helper"
```

---

### Task 3: Service worker push handling

**Files:**
- Modify: `src/app/sw.ts`

- [ ] **Step 1: Add push + notificationclick listeners**

In `src/app/sw.ts`, after the existing `serwist.addEventListeners();` line, add:

```ts
serwist.addEventListeners();

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "התראה חדשה", body: event.data.text() };
  }
  const title = payload.title ?? "התראה חדשה";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c && c.url.includes(url));
      if (existing && "focus" in existing) {
        await (existing as WindowClient).focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `PushEvent`, `NotificationEvent`, and `WindowClient` come from the `webworker` lib already listed in `tsconfig.json`'s `lib` array alongside `dom` — no new tsconfig changes needed (the existing `declare const self: ServiceWorkerGlobalScope & {...}` at the top of this file already shadows the ambient `self` correctly for this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/sw.ts
git commit -m "feat(push): handle push and notificationclick in service worker"
```

---

### Task 4: Subscribe API route

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as SubscriptionBody;
    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { error } = await db
      .from("push_subscriptions")
      .upsert({ user_email: user.email, endpoint, p256dh, auth }, { onConflict: "endpoint" });
    if (error) throw error;

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
git add src/app/api/push/subscribe/route.ts
git commit -m "feat(push): add admin push-subscription endpoint"
```

---

### Task 5: Push notification banner + admin dashboard wiring

**Files:**
- Create: `src/components/push-notification-banner.tsx`
- Modify: `src/components/admin-dashboard.tsx`

- [ ] **Step 1: Write the banner component**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return;
    setVisible(Notification.permission === "default");
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error("[push] subscribe failed", err);
    } finally {
      setVisible(false);
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
      <Bell size={18} className="text-primary shrink-0" />
      <p className="text-sm flex-1">הפעל התראות כדי לקבל התראה מיידית על פנייה חדשה מתאמן</p>
      <Button size="sm" onClick={enable} disabled={loading}>
        {loading ? "מפעיל..." : "הפעל התראות"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the admin dashboard**

In `src/components/admin-dashboard.tsx`, add the import near the other component imports:

```ts
import { PushNotificationBanner } from "@/components/push-notification-banner";
```

Then in the JSX returned by `AdminDashboard`, insert the banner right after the header block and before the `{/* Stat cards */}` comment (around line 93-95):

```tsx
      </div>

      <PushNotificationBanner />

      {/* Stat cards */}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/push-notification-banner.tsx src/components/admin-dashboard.tsx
git commit -m "feat(push): add enable-notifications banner to admin dashboard"
```

---

### Task 6: `contact.ts` — sender join, handled status, push trigger

**Files:**
- Modify: `src/lib/sheets/contact.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { db } from "@/lib/db/client";
import { sendPushToAdmins } from "@/lib/push/send";

export type ContactRequest = {
  id: string;
  student_id: string;
  subject: string;
  message: string;
  status: "new" | "read" | "handled";
  created_at: string;
  student_name: string;
  student_phone: string;
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

  const { data: student } = await db
    .from("students")
    .select("first_name, last_name")
    .eq("id", input.student_id)
    .maybeSingle();
  const studentName = student
    ? [student.first_name, student.last_name].filter(Boolean).join(" ") || "מתאמן"
    : "מתאמן";

  void sendPushToAdmins({
    title: "פנייה חדשה",
    body: `${studentName}: ${input.subject}`,
    url: "/admin/messages",
  });
}

export async function fetchContactRequests(): Promise<ContactRequest[]> {
  const { data } = await db
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Omit<ContactRequest, "student_name" | "student_phone">[];

  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      ...r,
      student_name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") || "מתאמן" : "מתאמן לא ידוע",
      student_phone: (s?.phone as string) ?? "",
    };
  });
}

export async function markContactRequestRead(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "read" }).eq("id", id);
}

export async function markContactRequestHandled(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "handled" }).eq("id", id);
}

export async function countNewContactRequests(): Promise<number> {
  const { count } = await db
    .from("contact_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file. If other files reference `ContactRequest` and destructure only the old fields, that's fine — adding fields to a type is additive and doesn't break existing consumers.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/contact.ts
git commit -m "feat(contact): join student identity, add handled status, trigger admin push"
```

---

### Task 7: `PATCH /api/admin/messages` — accept a status

**Files:**
- Modify: `src/app/api/admin/messages/route.ts`

- [ ] **Step 1: Update the PATCH handler**

Replace the full file contents:

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchContactRequests, markContactRequestRead, markContactRequestHandled } from "@/lib/sheets/contact";

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
    const { id, status } = (await req.json()) as { id: string; status?: "read" | "handled" };
    if (status === "handled") {
      await markContactRequestHandled(id);
    } else {
      await markContactRequestRead(id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/messages/route.ts
git commit -m "feat(contact): accept status in PATCH /api/admin/messages"
```

---

### Task 8: `AdminMessages` UI — sender display, open/handled tabs, mark-handled action

**Files:**
- Modify: `src/components/admin-messages.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle2 } from "lucide-react";
import type { ContactRequest } from "@/lib/sheets/contact";

async function fetchMessages(): Promise<ContactRequest[]> {
  const res = await fetch("/api/admin/messages");
  const data = (await res.json()) as { requests: ContactRequest[] };
  return data.requests;
}

async function patchMessage(id: string, status: "read" | "handled"): Promise<void> {
  await fetch("/api/admin/messages", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
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
    mutationFn: (id: string) => patchMessage(id, "read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-messages"] }),
  });

  const { mutate: markAsHandled, isPending: handling } = useMutation({
    mutationFn: (id: string) => patchMessage(id, "handled"),
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

  const all = messages ?? [];
  const open = all.filter((m) => m.status !== "handled");
  const handled = all.filter((m) => m.status === "handled");

  return (
    <Tabs defaultValue="open" dir="rtl">
      <TabsList>
        <TabsTrigger value="open">פתוחות{open.length > 0 ? ` (${open.length})` : ""}</TabsTrigger>
        <TabsTrigger value="handled">טופלו{handled.length > 0 ? ` (${handled.length})` : ""}</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="mt-3">
        <MessageList
          messages={open}
          expanded={expanded}
          onExpand={handleExpand}
          onMarkHandled={(id) => markAsHandled(id)}
          handling={handling}
          emptyText="אין פניות פתוחות"
        />
      </TabsContent>
      <TabsContent value="handled" className="mt-3">
        <MessageList messages={handled} expanded={expanded} onExpand={handleExpand} emptyText="אין פניות שטופלו" />
      </TabsContent>
    </Tabs>
  );
}

function MessageList({
  messages,
  expanded,
  onExpand,
  onMarkHandled,
  handling,
  emptyText,
}: {
  messages: ContactRequest[];
  expanded: string | null;
  onExpand: (id: string, status: string) => void;
  onMarkHandled?: (id: string) => void;
  handling?: boolean;
  emptyText: string;
}) {
  if (messages.length === 0) {
    return <p className="text-muted-foreground text-center py-12">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <Card key={m.id} className="cursor-pointer" onClick={() => onExpand(m.id, m.status)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-semibold text-sm">{m.student_name}</span>
                  {m.student_phone && <span className="text-xs text-muted-foreground">{m.student_phone}</span>}
                  {m.status === "new" && <Badge className="text-xs">חדש</Badge>}
                  {m.status === "handled" && (
                    <Badge variant="secondary" className="text-xs">
                      טופל
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">{m.subject}</p>
                <p className={`text-sm text-muted-foreground ${expanded === m.id ? "" : "truncate"}`}>{m.message}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(m.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>

            {onMarkHandled && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={handling}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkHandled(m.id);
                  }}
                >
                  <CheckCircle2 size={14} className="ml-1.5" />
                  סמן כטופל
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this task touches no pure-logic module, so no test file needs updating).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-messages.tsx
git commit -m "feat(contact): show sender identity and open/handled tabs in admin messages"
```

---

### Task 9: `.env.local.example` + final verification

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Add the three new env var names (no values)**

Append to `.env.local.example`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

- [ ] **Step 2: Full-repo typecheck and test run**

Run:
```bash
npx tsc --noEmit
npm run test:run
```
Expected: both pass with zero errors/failures.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example
git commit -m "docs: document VAPID env vars in .env.local.example"
```

- [ ] **Step 4: Push everything to main**

```bash
git push origin main
```

- [ ] **Step 5: Manual verification checklist (report this to the user, do not attempt it yourself — no live credentials/device in this environment)**

Tell the user, after they've added the three VAPID env vars to Vercel and run the migration:
1. Open the admin dashboard on a phone where the app is installed to the home screen.
2. Confirm the "הפעל התראות" banner appears; tap it and grant permission.
3. From a student account (or ask a student), submit a contact request via `/student/contact`.
4. Confirm a push notification appears on the admin's phone within a few seconds, and tapping it opens `/admin/messages`.
5. Confirm the request shows the student's name in the list, and that "סמן כטופל" moves it to the "טופלו" tab.
