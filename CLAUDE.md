@AGENTS.md

# Project: Snooker Academy – Coach & Admin Management App

## Architecture
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, React 19
- **Auth:** Supabase Auth (`@supabase/ssr`) — email magic link + invite flow
- **Database:** Supabase (primary data store) — tables: sessions, students, coaches, groups, pricing, guidelines, attendance, notes
- **DB client:** Supabase service role (`src/lib/db/client.ts`) — server-side only, never import in client components
- **Hosting:** Vercel (production), local dev with `npm run dev`
- **PWA:** Serwist (`@serwist/next`)

## Roles
Three roles only: `admin | coach | denied`
- Resolved in `src/lib/auth/resolveRole.ts` — admins come from `ADMIN_EMAILS` env var, coaches from the active coaches sheet
- Middleware (`src/middleware.ts`) guards `/coach` and `/admin` routes
- Never expose the service role key to the browser

## Directory Structure
- `src/app/(admin)/` – admin-only pages (schedule, coaches, students, groups, pricing, guidelines)
- `src/app/(coach)/` – coach-only pages (schedule, sessions, profile, pricing, guidelines)
- `src/app/api/` – API routes (return `NextResponse.json()` with typed responses)
- `src/components/` – feature components; `src/components/ui/` – shadcn/ui primitives
- `src/lib/auth/` – role resolution and user helpers
- `src/lib/sheets/` – all Google Sheets read/write logic (sessions, coaches, students, groups, pricing, guidelines, notes, attendance)
- `src/lib/supabase/` – browser and server Supabase clients
- `src/lib/google/` – Google API client setup

## Data Layer Rules
- **All business data lives in Supabase** — use the modules in `src/lib/sheets/` (legacy folder name, all use `db` from Supabase)
- Never query `db` directly from a component or page — always go through a module in `src/lib/sheets/`
- `src/lib/db/client.ts` — Supabase service role client, server-side only, never import in client components
- `src/lib/supabase/server.ts` — for reading the current user in server components / API routes
- `src/lib/supabase/browser.ts` — for client-side auth operations only
- Google Drive (`src/lib/google/sheets.ts`) — exists for Drive file browsing only, not the primary data source

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Test (watch): `npm run test`
- Test (single run): `npm run test:run`

## Code Conventions
- Always use TypeScript strict mode — never use `any`, define proper interfaces
- Components: PascalCase, one per file
- API routes: always return typed `NextResponse.json()` responses
- Prefer server components; add `"use client"` only when required (event handlers, hooks, browser APIs)
- Always wrap async operations in try/catch in API routes
- Use `@/` alias for all imports from `src/`
- UI primitives: use shadcn/ui from `src/components/ui/` — don't install new UI libraries without discussion
- Toast notifications: use `sonner` (`src/components/ui/sonner.tsx`)
- Data fetching on client: TanStack Query (`@tanstack/react-query`)

## Git
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- Push directly to `main` — no need to create a branch
- Never commit `.env*` files or any file containing API keys or secrets

## Security: Pending
- **Webhook auth** — `src/app/api/webhooks/crm/` routes have no secret validation. `CRM_WEBHOOK_SECRET` is defined in `.env.local.example` but never used. Blocked on getting access to configure the secret in the CRM. Once access is available: read the secret from `process.env.CRM_WEBHOOK_SECRET` and validate the `x-webhook-secret` header in all three webhook routes before processing the payload.
- **Export API key** — ✅ Fixed: `/api/export/students` now accepts only `Authorization: Bearer` header (query param removed).

## WhatsApp (Green API)
- Instance/token env vars: `GREENAPI_INSTANCE_ID`, `GREENAPI_TOKEN`
- Client: `src/lib/whatsapp/greenapi.ts` — `sendWhatsAppMessage(phoneOrChatId, message)`, `getWhatsAppGroups()`
- Scheduled messages table: `whatsapp_scheduled` (Supabase) — id, chat_id, chat_name, message, scheduled_at, status
- Cron endpoint: `POST /api/cron/whatsapp-send` — secured with `Authorization: Bearer <CRON_SECRET>`. Handles special chat_ids: `coaches:all` (sends to all active coaches), `coach:<email>` (single coach by email), or a WhatsApp group id (`XXXXXX@g.us`)
- Cron job configured on cron-job.org to hit the endpoint
- Admin button "שלח תזכורות" in dashboard (`src/components/admin-dashboard.tsx`) → `POST /api/cron/daily-reminder` — sends today's sessions summary to each coach via WhatsApp
- Scheduler UI: `src/components/whatsapp-scheduler.tsx`, page: `/admin/whatsapp`

## WhatsApp OTP Login
- **Routes:** `POST /api/auth/whatsapp-otp/send` + `POST /api/auth/whatsapp-otp/verify`
- **Flow:** phone → Green API WhatsApp OTP → HMAC-signed token (no DB) → Supabase `admin.generateLink` → `/auth/callback` → session
- **Requires:** `OTP_SECRET` env var (any random string, set in Vercel)
- **Phone lookup:** searches `coaches` and `students` tables by phone (local `0XXXXXXXXX` and intl `972XXXXXXXXX` formats)
- **UI:** "כניסה עם WhatsApp" button on login page (below existing email forms), WhatsApp green styling

## Email + Password Login (added 2026-07-23)
- **Login page** (`src/app/login/page.tsx`): both tabs now toggle between WhatsApp OTP and email+password (`signInWithPassword`). Staff tab defaults to WhatsApp; student tab defaults to email+password. The old email-OTP flow (`signInWithOtp`) was removed entirely.
- **Getting a password (first time):** no automatic emails, no admin-generated/relayed passwords. In `/admin/coaches` and `/admin/students`, every row has a manual "שלח קישור הזמנה" (mail icon) button — admin clicks it whenever they want, for any row (new or existing, including students that arrived via the CRM webhook).
- **`src/lib/auth/invite.ts`** — `sendLoginInvite(email, origin)`: calls Supabase `inviteUserByEmail`, falls back to `resetPasswordForEmail` if the user already exists. `origin` is derived from the request URL (`new URL(req.url).origin`), not an env var — avoids the redirect bugs that broke the original version of this flow (see git history around `75effaf`/`62d051a`, June 2026).
- **`POST /api/admin/invite`** — admin-only route wrapping `sendLoginInvite`. Redirects through `/auth/callback?next=/set-password` (existing route, unchanged) to `/set-password` (existing page, unchanged).
- **Changing password anytime:** "שינוי סיסמה" button on the profile page (`ProfileCard`, used by admin/coach/student profile pages) → `/set-password`. Students got a new `/student/profile` page + nav item for this (didn't exist before).
- **Explicitly not touched:** `src/lib/sheets/students.ts` (`appendStudent`, `upsertStudentFromCrm`) and the CRM webhook route — no automatic password/invite logic was added to account creation, by design.
- Spec: `docs/superpowers/specs/2026-07-23-email-password-login-design.md`, plan: `docs/superpowers/plans/2026-07-23-email-password-login.md`

## Auth Architecture (updated 2026-06-21)
- **Middleware** (`src/middleware.ts`): uses `getSession()` (local cookie read, no network) — excludes `/api/*` from matcher
- **Layouts** (`(admin)/layout.tsx`, `(coach)/layout.tsx`): use `getSession()` — no Supabase network call on navigation
- **API routes** (`requireUser` in `src/lib/auth/requireUser.ts`): use `getUser()` — real server verification, protects data access
- **Result:** 4–6 Supabase network calls per page load → 1–2 (only in API routes)

## Performance (updated 2026-06-21)
- **Stats API caching:** `/api/admin/stats` and `/api/coach/stats` use `unstable_cache` with 30s TTL — DB queries skipped on repeated fetches
- **Recharts lazy-loaded:** charts extracted to `admin-charts.tsx` / `coach-charts.tsx`, imported via `next/dynamic` — removed from initial bundle
- **Notes batch query:** `fetchNotesForMultipleStudents()` in `src/lib/sheets/notes.ts` — session detail fetches all notes in 1 query instead of N
- **Loading skeletons:** `src/app/(admin)/admin/loading.tsx` and `src/app/(coach)/coach/loading.tsx`

## Google Sheets Integration (Pending)
- **Goal:** Display data from an existing external Google Sheets file in the admin panel, and show events/tournaments from it in the Schedule page
- **Sheet ID:** `1JVTHG5UTnUe1bzZKct91EfpaEH4DUi8B8SbKT-45MU0`
- **Sheet shared** with the service account in `GOOGLE_SERVICE_ACCOUNT_JSON`
- **Sheets client:** `getSheetsClient()` from `src/lib/google/sheets.ts` — already has `spreadsheets` scope
- **Stopped at:** Need to know the tab names and column structure before building. User to provide tab names + column headers for the events/tournaments tab so we can map them to the Schedule view.
- Events from the sheet should appear in the existing Schedule page alongside regular sessions, in a distinct color/style.