# Admin Contact-Request Notifications — Design

## Problem

Students submit inquiries ("פנייה") from `/student/contact`, stored in `contact_requests`. Today:

1. **No real notification.** The only signal an admin gets is a "פניות חדשות" counter card on `/admin` (cached 30s, `unstable_cache`) — nothing pops up. An admin who isn't actively looking at the dashboard has no idea a new inquiry arrived. Admins have the app installed on their phone's home screen as a PWA and expect real push notifications, the way any installed app would behave.
2. **No sender identity.** `AdminMessages` (`/admin/messages`) renders only `subject`, `message`, and `created_at` — never who sent it. `fetchContactRequests()` selects `contact_requests.*` only, with no join to `students`.
3. **No resolution action.** `status` only ever moves `new` → `read` (implicitly, by expanding the card). There's no way to mark an inquiry as actually handled, so the list has no notion of "done" — everything accumulates forever with no way to distinguish outstanding work from resolved.

## Goals

- A new contact request triggers a real OS-level push notification on every admin's phone (installed PWA), tapping it opens `/admin/messages`.
- The admin messages list shows who sent each inquiry (student name).
- An admin can mark an inquiry "טופל" (handled); the list defaults to showing open inquiries (new/read) with a separate view for handled ones.

## Out of scope (explicitly deferred, per user's answers)

- No in-app reply/compose flow, no one-tap call/WhatsApp-the-student shortcut, no delete. "טופל" is the only new action.
- No notification preferences UI beyond a single enable banner (no per-category toggles, no snooze).
- No push notifications for anything other than new contact requests (e.g. not for new WhatsApp replies, not for session changes) — this spec covers contact requests only. The plumbing (VAPID keys, subscription table, send helper) is written so a future feature can reuse it, but no other trigger is wired up now.

## Architecture

### 1. Push notification infrastructure (new)

**Package:** `web-push` (+ `@types/web-push` dev dependency) — standard Web Push (VAPID) library, no external service needed beyond the browser's own push service.

**VAPID keys:** generated once (`npx web-push generate-vapid-keys`), added as env vars:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — safe to expose, used client-side to subscribe
- `VAPID_PRIVATE_KEY` — server-side only, used to sign push payloads
- `VAPID_SUBJECT` — a `mailto:` contact address web-push requires (e.g. `mailto:maksim110044@gmail.com`)

These must be added to Vercel's env vars by the user (no direct Vercel access in this environment); the implementer adds placeholder keys to `.env.local.example` and hands the user the real generated values to paste into Vercel + their own `.env.local`.

**Table `push_subscriptions`** (new migration):
```sql
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
`endpoint` is unique per browser/device subscription — re-subscribing the same device (e.g. after clearing permission and re-granting) upserts rather than duplicating. No policies defined (matches every other table in this codebase): only the service-role `db` client reads/writes it, RLS blocks anon/authenticated access entirely.

**Service worker (`src/app/sw.ts`):** add a `push` listener that shows a `Notification` from the payload JSON (`{title, body, url}`), and a `notificationclick` listener that focuses an existing tab on `url` or opens a new one.

**Subscribe flow (client):**
- `src/components/push-notification-banner.tsx` (new, `"use client"`) — rendered at the top of the admin dashboard. Reads `Notification.permission`; if `"default"` (never asked) shows a banner "הפעל התראות על פניות חדשות" with a button. On click: requests permission → if granted, calls `navigator.serviceWorker.ready` → `registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: <converted NEXT_PUBLIC_VAPID_PUBLIC_KEY>})` → POSTs the subscription to `/api/push/subscribe`. If the user denies, or permission is already `"granted"`/`"denied"`, the banner never renders again (checked from `Notification.permission` directly, no extra state needed). If `Notification`/push isn't supported in the browser at all, the banner doesn't render.
- `POST /api/push/subscribe` (new, admin-only via `requireUser`) — upserts a row into `push_subscriptions` keyed by `endpoint`, with `user_email` from the authed admin.

**Send helper (server):** `src/lib/push/send.ts` (new) — `sendPushToAdmins(payload: {title: string; body: string; url: string})`:
- Reads `ADMIN_EMAILS` env var (same parsing as `resolveRole.ts`: split on `,`, trim, lowercase).
- Fetches all `push_subscriptions` rows for those emails.
- Calls `webpush.sendNotification(subscription, JSON.stringify(payload))` for each, in parallel.
- On a `410`/`404` response (subscription expired/gone), deletes that row from `push_subscriptions`. Other errors are logged and swallowed — a broken push must never fail the contact-request submission itself.

**Trigger:** `insertContactRequest()` in `src/lib/sheets/contact.ts` — after the insert, looks up the student's name (already has `student_id`) and calls `sendPushToAdmins({title: "פנייה חדשה", body: `${studentName}: ${subject}`, url: "/admin/messages"})`. Fire-and-forget from the API route's perspective — its failure doesn't affect the `POST /api/student/contact` response.

### 2. Sender identity in the admin messages list

- `ContactRequest` type gains `student_name: string` (and `student_phone: string`, since we already fetch the row and it costs nothing extra to include).
- `fetchContactRequests()` fetches `students` (`id, first_name, last_name, phone`) for the distinct `student_id`s in one extra query (same batch-fetch pattern as `fetchNotesForMultipleStudents`), and maps each request to include the student's name/phone. A request whose student was deleted shows "מתאמן לא ידוע" rather than crashing.
- `AdminMessages` renders the student name (bold, above the subject) and phone (small, muted) on each card.

### 3. "טופל" status

- `ContactRequest.status` type widens from `"new" | "read"` to `"new" | "read" | "handled"`. No migration needed — the column is plain `TEXT` with no check constraint (confirmed: `contact_requests` itself predates this repo's tracked migrations, and every other status write in this codebase already just writes a free-form string to it).
- `markContactRequestRead` is joined by a new `markContactRequestHandled(id)` in `contact.ts` (`status: "handled"`).
- `PATCH /api/admin/messages` — body becomes `{ id: string; status: "read" | "handled" }` (was implicitly always "read"); routes to the matching function.
- `countNewContactRequests()` unchanged — still counts `status = 'new'` only, so the dashboard badge behavior is unaffected by the new status.
- `AdminMessages` UI: two filter tabs, "פתוחות" (default — status new or read) and "טופלו" (status handled). Each open card gets a "סמן כטופל" button (alongside the existing expand-to-read behavior); handled cards (in the "טופלו" tab) show a "טופל" badge instead of the "חדש" badge, no action button.

## Data Flow

1. Student submits `/student/contact` → `POST /api/student/contact` → `insertContactRequest()` inserts the row, then fires `sendPushToAdmins(...)` (best-effort, errors logged not thrown).
2. Each admin's registered device(s) receive an OS push notification via the browser's push service → service worker shows it → tap opens/focuses `/admin/messages`.
3. Admin opens `/admin/messages` (or the dashboard counter) regardless of whether push worked — the existing fetch-on-load path is unchanged, push is additive, not a replacement data path.
4. Admin marks an inquiry "טופל" → `PATCH /api/admin/messages` → list re-fetches, card moves to the "טופלו" tab.

## Error Handling

- Push send failures (network error, expired subscription, missing VAPID env vars) never throw out of `insertContactRequest`/the contact API route — wrapped in try/catch, logged via `console.error`, request submission always succeeds for the student regardless of push outcome.
- If VAPID env vars are unset (e.g. before the user has added them to Vercel), `sendPushToAdmins` no-ops early (logs a warning once) rather than crashing `web-push`'s constructor.
- `POST /api/push/subscribe` validates the subscription payload shape (`endpoint`, `keys.p256dh`, `keys.auth` all present strings) before upserting; malformed bodies return 400.
- Browsers without push support (`"serviceWorker" in navigator && "PushManager" in window` both required) never show the enable banner — no error, just absent.

## Testing

- Unit tests (Vitest) for the pure/mockable pieces:
  - `sendPushToAdmins` — mock `web-push`'s `sendNotification` and the `db` client; assert it fetches only subscriptions for `ADMIN_EMAILS`, calls send once per subscription, and deletes a subscription row on a `410` response.
  - `fetchContactRequests` — mock `db`; assert the returned rows carry `student_name`/`student_phone` joined correctly, and that a missing student falls back to "מתאמן לא ידוע".
- No new pure-logic module is created (everything here touches `db` or browser APIs), so no `-shared.ts` split is needed — but `sendPushToAdmins` and `fetchContactRequests` are still each individually unit-testable by mocking their one external dependency, per existing patterns in this codebase (e.g. `salary.ts`'s tests).
- Manual verification (documented in the plan, not automatable): the implementer/user actually grants notification permission on a real device and confirms a real push arrives after submitting a test contact request — this is fundamentally not something `npm run test:run`/`tsc` can verify.

## Follow-up not built now

- Re-sending an invite/enabling notifications from the admin's own profile page (in case the banner was dismissed by denying permission — browsers don't let JS re-prompt after an explicit deny, the admin would need to re-enable notifications for the site in their own browser/OS settings). Out of scope; not requested.
