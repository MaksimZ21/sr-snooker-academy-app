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
- Never commit directly to `main` — always create a branch
- Never commit `.env*` files or any file containing API keys or secrets
