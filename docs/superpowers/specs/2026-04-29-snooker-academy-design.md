# Snooker Academy Management App — Design Spec

**Source spec:** `אפליקציית ניהול אקדמיה - גרסה 1.txt` (v1.0, 2026-04-16)
**Design date:** 2026-04-29
**Status:** Approved through Section 6, pending user spec review

---

## 1. Goals & scope

A daily-management PWA for a snooker academy.

**Users**
- **Coach** — sees their own lessons today, marks attendance at the end of each lesson, writes per-student notes, browses guidelines, references the price list.
- **Admin** — sees everything in real-time across all coaches, with coach-filter; manages all underlying data directly in Google Sheets.

**v1 scope: all 11 features from the source spec.**

1. Mobile-first PWA (installable from browser, auto-updates, offline shell)
2. Google OAuth sign-in via Supabase Auth
3. Google Sheets as the system of record
4. Role-based UI (coach vs admin)
5. Dashboard (next-session and previous-session cards)
6. Weekly schedule view with week navigation
7. Session detail (attendance, per-student notes, syllabus image gallery from Drive, training-type guidelines)
8. Guidelines library, organized by category
9. Pricing page
10. Settings / profile
11. Hebrew + RTL throughout

**Out of scope for v1** (named explicitly to prevent creep)
- Push notifications
- Offline writes
- Languages other than Hebrew
- Coach-uploaded photos
- In-app admin CRUD UI (admin uses Sheets directly)
- Billing/payments

---

## 2. High-level architecture

```
Browser (PWA, RTL)
  ↓ Supabase JS client (Google OAuth, session)
  ↓ fetch with bearer token
Next.js on Vercel
  ├── Route Handlers /api/*  → service-account auth → googleapis (Sheets + Drive)
  ├── Server Components       → initial data render (auth-aware)
  └── Middleware              → guards /admin/* and /coach/* by role

Google Workspace (academy-owned)
  ├── Sheets workbook (Coaches, Students, Sessions, Attendance, Notes, Guidelines, Pricing)
  └── Drive folders (one per session, syllabus images)

Supabase (cloud)
  └── Auth only (no tables, no storage)
```

**Locked stack**
- **Hosting:** Vercel (production + preview environments)
- **Framework:** Next.js 15, App Router, Server Components + Route Handlers
- **Auth:** Supabase Auth (Google OAuth provider)
- **Data:** Google Sheets via `googleapis` SDK, service-account auth, server-side only
- **Files:** Google Drive (read-only, per-session folder)
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Client data:** TanStack Query with polling
- **Validation:** Zod at the Sheets boundary
- **PWA:** serwist for service worker + manifest

**Key flows**
- **Login:** user hits app → Supabase redirects to Google → callback → cookie set → middleware resolves role → redirect to `/coach` or `/admin`.
- **Coach dashboard:** Server Component renders today's sessions for the logged-in coach. Client component polls `/api/sessions/today` every 60s.
- **Admin dashboard:** same shape, all coaches, with coach-filter dropdown, polls every 30s.
- **Write attendance/note:** client → `POST /api/sessions/:id/attendance` (or `/notes`) → server validates role + ownership → appends row in Sheets → `revalidateTag`.

---

## 3. Data model — Google Sheets schema

One workbook, multiple sheets. Header row is row 1. Primary keys are noted.

### `Coaches`
| Column | Type | Notes |
|---|---|---|
| `email` (PK) | string | Coach's Google email; allowlist |
| `name` | string | Display name |
| `phone` | string | Optional |
| `active` | bool | `TRUE`/`FALSE`; inactive = denied |

### `Students`
| Column | Type | Notes |
|---|---|---|
| `id` (PK) | string | e.g., `S001` |
| `name` | string | |
| `phone` | string | Optional |
| `parent_name` | string | For minors |
| `parent_phone` | string | For minors |
| `general_notes` | string | Persistent info admin keeps |
| `active` | bool | |

### `Sessions`
| Column | Type | Notes |
|---|---|---|
| `id` (PK) | string | e.g., `SES-2026-04-29-001` |
| `date` | ISO date | `YYYY-MM-DD` |
| `start_time` | `HH:MM` | |
| `end_time` | `HH:MM` | |
| `coach_email` | string | FK → Coaches.email |
| `training_type` | enum | private / group / beginners / advanced / technique / match-play |
| `student_ids` | csv | Comma-separated FKs → Students.id (e.g., `S001,S003`) |
| `drive_folder_url` | string | Drive folder for syllabus images, optional |
| `status` | enum | scheduled / completed / cancelled |

### `Attendance`
| Column | Type | Notes |
|---|---|---|
| `session_id` | string | FK |
| `student_id` | string | FK |
| `status` | enum | present / absent / late |
| `marked_by` | string | Coach email |
| `marked_at` | ISO datetime | |

Row exists only after the coach marks it — absence of row = unmarked.

### `Notes`
| Column | Type | Notes |
|---|---|---|
| `id` (PK) | string | UUID |
| `student_id` | string | FK |
| `session_id` | string | FK (the session during which the note was taken) |
| `coach_email` | string | Author |
| `text` | string | Free text |
| `created_at` | ISO datetime | |

Notes are per-student; session detail shows past notes for each attending student.

### `Guidelines`
| Column | Type | Notes |
|---|---|---|
| `id` (PK) | string | |
| `category` | string | Top-level grouping |
| `order` | int | Sort within category |
| `training_type` | enum | Optional; if set, filtered into matching session detail |
| `title` | string | Hebrew |
| `body_or_link` | string | Inline body or Drive doc URL |

### `Pricing`
| Column | Type | Notes |
|---|---|---|
| `lesson_type` | string | |
| `duration_min` | int | |
| `price_nis` | int | |
| `notes` | string | Hebrew |

**Pricing semantics — open question:** the source spec says "מחירון למאמנים שמושך מידע מ-Google Sheets ומציג טבלה". Default interpretation in this design: **lesson prices charged to students**, which coaches reference when quoting parents. Confirm before build; the schema is identical for either interpretation.

**Modeling notes**
- `student_ids` as CSV in Sessions instead of a junction sheet — keeps the sheet readable for the admin and is fine for academy-scale data.
- Training type is free-text-ish but constrained by enum at app boundary (Zod) so admin typos surface quickly.
- One coach per session (no co-coaching in v1).
- Sessions are pre-scheduled by admin in Sheets; coaches do not create sessions.

---

## 4. Routes & UI structure

```
/                         Landing → redirects based on auth/role
/login                    Google sign-in (Supabase Auth UI)
/coach                    Coach dashboard (next + previous session cards)
/coach/schedule           Weekly schedule, week navigation
/coach/sessions/[id]      Session detail (attendance, notes, syllabus, guidelines)
/coach/guidelines         Guidelines library, filter by category/training type
/coach/pricing            Pricing table (read-only)
/coach/profile            Settings, role, sign out
/admin                    Admin dashboard (today's sessions, all coaches)
/admin/schedule           Same weekly view, with coach filter
/admin/coaches            Coach list with activity stats (read-only)
/admin/sessions/[id]      Same session detail as coach view, read-only
```

**Layout**
- Single root layout: `<html dir="rtl" lang="he">`, Heebo or Rubik font, Tailwind RTL plugin.
- Two route groups: `(coach)` and `(admin)`, each with its own nav. Bottom tab bar on mobile, side rail on desktop.
- shadcn/ui throughout — `Card`, `Tabs`, `Sheet`, `Dialog`, `Calendar`, `Form`, `Toast`.

**Key screens**
- **Dashboard:** two stacked cards (next session, previous session). Each shows time, training type, student count, primary action.
- **Weekly schedule:** 7-day grid (Sunday–Saturday), sessions as colored blocks; tap → detail. Week-nav arrows + "היום" button.
- **Session detail:** four tabs — `נוכחות` (attendance checklist), `הערות` (per-student note threads with history), `סילבוס` (Drive image grid, lazy-loaded), `הנחיות` (training-type-filtered guidelines).
- **Admin views** reuse the same components, fed broader data + a coach filter.

**Dates and locale**
- All dates Gregorian, formatted in Hebrew (`יום ראשון, 16 באפריל 2026`) via `Intl.DateTimeFormat('he-IL')`.
- No Hebrew calendar.

**PWA shell**
- Cached app shell + offline fallback page.
- No offline writes in v1 — writes require server round-trip.

---

## 5. Auth, authorization, role resolution

**Sign-in flow**
1. User hits any protected route → middleware checks Supabase session cookie.
2. Not authenticated → redirect to `/login`.
3. `/login` shows "Sign in with Google".
4. Google OAuth callback → Supabase sets session cookie → redirect to `/`.
5. `/` resolves role and redirects to `/coach` or `/admin`.

**Role resolution** (single function, called on every protected request)
```
resolveRole(email):
  if email in ADMIN_EMAILS env (csv)              → "admin"
  else if email in Coaches sheet AND active=TRUE  → "coach"
  else                                             → "denied"
```

- Cached per request via `cache()`. Coaches sheet read cached for 60s.
- "denied" → page that shows the user's email and asks them to contact the admin.

**Authorization guards**
- **Middleware:** redirects unauthenticated users; redirects coaches off `/admin/*` and admins off `/coach/*` route groups.
- **Server-side per route:** every API handler re-checks role and ownership. Never trusts client-supplied role.
- **Ownership rule:** a coach can read/write a session only if `session.coach_email === user.email`. Admins can read any session; admin writes are rare and audited.

**Service-account access to Google Workspace**
- One Google Cloud service account; JSON key in Vercel env (`GOOGLE_SERVICE_ACCOUNT_JSON`).
- Sheet shared with the service-account email as Editor.
- Drive folders shared with the service-account email as Reader.
- Scopes: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.readonly`.

**Environment variables**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-side only
GOOGLE_SERVICE_ACCOUNT_JSON       # full JSON, escaped
GOOGLE_SHEET_ID                    # production
GOOGLE_SHEET_ID_TEST               # preview environments
ADMIN_EMAILS                       # comma-separated
```

---

## 6. Caching, real-time, error handling

### Cache map

| Data | Cache | Tag | Invalidates on |
|---|---|---|---|
| Coaches | 5 min | `coaches` | Manual refresh |
| Students | 5 min | `students` | Manual refresh |
| Sessions (today) | 30s | `sessions:today` | Any attendance/note write |
| Sessions (week) | 60s | `sessions:week` | Session-row change |
| Attendance | 30s | `attendance:<sessionId>` | Write to that session |
| Notes | 30s | `notes:<studentId>` | Note write for that student |
| Guidelines | 5 min | `guidelines` | Manual refresh |
| Pricing | 5 min | `pricing` | Manual refresh |

Implemented with Next.js `unstable_cache` and `revalidateTag` on writes.

### "Real-time" admin polling
- TanStack Query `refetchInterval: 30_000` on admin views.
- Coach views poll at 60s.
- Pause polling when tab is not visible.

### Writes — optimistic UI + reconciliation
- Mark attendance / save note → optimistic update in cache → POST to API.
- Server appends to Sheets, calls `revalidateTag`, returns canonical row.
- Client reconciles on success. On error: rollback + toast with retry.

### Error handling
- **Sheets API errors:** retry once with backoff; if still failing, Hebrew toast + retry button, optimistic state preserved.
- **Auth errors:** middleware redirects to `/login`; expired tokens refreshed by Supabase client automatically.
- **Role denied:** dedicated 403 page with the user's email and "contact your admin".
- **Drive folder missing/empty:** session detail shows "אין תמונות עדיין".
- **Network offline (PWA):** read-only views serve last cached data with offline banner; writes blocked with toast "יש לחבר לאינטרנט".
- **Schema drift:** Zod validation throws → API returns 500, server logs the offending row, user sees "שגיאת מערכת, פנה למנהל".

### Logging
- Vercel function logs: every API request with `email`, `role`, `route`, `latency_ms`, `result`.
- Lesson notes never logged.

---

## 7. Testing strategy

| Layer | Tool | What we test |
|---|---|---|
| Unit | Vitest | Role resolver, Sheets row Zod parsers, date/RTL helpers |
| API route handlers | Vitest + msw or fake `googleapis` | Auth checks, ownership rules, write-then-read correctness |
| Component | Vitest + React Testing Library | Attendance widget, notes form, schedule grid (RTL rendering) |
| E2E | Playwright (one happy path) | Coach signs in → marks attendance → admin sees update |

Coverage target is *risky* behavior, not high percentage. TDD on the role resolver and Sheets parsers (highest blast radius if wrong).

**Test data**
- Separate test workbook (`GOOGLE_SHEET_ID_TEST`) for E2E and integration tests.
- Unit tests use fixture rows; no real Sheets calls.

---

## 8. Deployment & operations

**Vercel project**
- Two environments: **Production** (main branch, live sheet) and **Preview** (every PR, test sheet).
- Env vars set in Vercel dashboard, not committed.
- Build: `next build`. Auto-deploy on push to `main`.
- Domain: `academy.vercel.app` initially; custom domain pluggable.

**Operations**
- Admin runbook in `docs/`: add a coach (edit Coaches sheet), schedule a session, add a syllabus folder, grant Drive access to the service account.
- Vercel built-in error monitoring; no Sentry in v1.
- Supabase free tier sufficient for auth-only usage.

---

## 9. Open items to confirm before build

1. **Pricing page semantics** — is the pricing list student-facing prices or coach compensation? This design assumes student-facing. (See §3.)
2. **Co-coaching** — confirm one coach per session is sufficient.
3. **Cancelled sessions** — should cancelled sessions appear on the weekly grid grayed-out, or be hidden? Default: grayed-out.
4. **Note edit/delete** — can a coach edit or delete their own notes after saving? Default: append-only (no edit/delete in v1).
5. **Time zone** — assume Asia/Jerusalem for all date/time display and storage.

---

## 10. Glossary (Hebrew ↔ English)

| Hebrew | English | Used as |
|---|---|---|
| מאמן | coach | role |
| מנהל / אדמין | admin | role |
| מתאמן | student / trainee | entity |
| מפגש / שיעור | session / lesson | entity |
| נוכחות | attendance | feature |
| הערות | notes | feature |
| הנחיות | guidelines | feature |
| מחירון | pricing | feature |
| סילבוס | syllabus | concept |
