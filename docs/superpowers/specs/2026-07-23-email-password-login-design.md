# Email + Password Login — Design

Date: 2026-07-23

## Background

The app currently has three login mechanisms wired into `src/app/login/page.tsx`:
- Staff tab (מאמן/אדמין): WhatsApp OTP only.
- Student tab (מתאמן): email OTP (`supabase.auth.signInWithOtp`) by default, with a toggle to WhatsApp OTP.

An email+password flow (`StaffLoginForm`) already exists in the file but is unused — it was removed from the UI in commit `75effaf` after the invite-email flow that was supposed to provision passwords kept breaking (missing site URL, session not set server-side, swallowed invite errors, duplicate-user handling — five bugfix commits across two days before it was abandoned in favor of WhatsApp-only). The root cause was Supabase's `inviteUserByEmail` + magic-link redirect/`exchangeCodeForSession` chain, not the password login form itself or `/set-password` (which just calls `supabase.auth.updateUser({password})` on an already-authenticated session and works fine).

This design brings email+password back, but sidesteps the fragile invite-link mechanism entirely: instead of emailing a link, the admin generates the account with a random initial password up front and hands it to the person directly. WhatsApp OTP remains available everywhere as a fallback/primary as specified below.

## Scope

1. Initial password generation on coach/student creation (admin-facing only).
2. Login page: restore email+password as a login option on both tabs, alongside WhatsApp.
3. Self-service password change, reachable from profile pages (including a new one for students).

Explicitly out of scope: initial passwords for existing coaches/students (WhatsApp OTP remains their only path unless an admin manually re-triggers something — not built here), any SMS/email delivery of the password (admin conveys it manually), rate limiting on password login (already covered by Supabase Auth defaults).

## 1. Initial password generation

**`src/lib/auth/password.ts`** (new) — `generateInitialPassword(): string`. Random 8-character string from an unambiguous alphabet (excludes `0/O/1/l/I` etc.), built with `crypto.randomInt` (same primitive already used for WhatsApp OTP codes in `src/app/api/auth/whatsapp-otp/send/route.ts`).

**`src/lib/sheets/coaches-write.ts` — `appendCoach`**: replace `createUser({ email, email_confirm: true })` with `createUser({ email, email_confirm: true, password: generateInitialPassword() })`. Check the returned `error`:
- No error → account is new, return `{ email, initialPassword }`.
- Error (already exists — re-adding an existing coach) → behavior unchanged from today (silently ignored), return `{ email, initialPassword: null }`. Existing password, if any, is left untouched.

**`src/lib/sheets/students.ts`**: `appendStudent` is called from two places — the admin "add student" dialog (`POST /api/students`) and `upsertStudentFromCrm`, which is driven by the unattended CRM webhook (`src/app/api/webhooks/crm/route.ts`). A generated password is only useful when a human (the admin) is present to relay it, so `appendStudent` itself stays unchanged (DB insert only) and the CRM path is left untouched. Instead, add a new exported function `provisionStudentAuthUser(email: string): Promise<string | null>` (same `createUser`-with-generated-password logic as coaches, returns the password or `null` on missing/duplicate). `POST /api/students` calls `appendStudent(body)` as today, then, only when `body.email` is non-empty, calls `provisionStudentAuthUser(body.email)` for the password. The webhook path never calls this function, so CRM-created students are provisioned lazily via OTP exactly as they are today — no change in behavior there.

**API routes**:
- `POST /api/coaches` ([coaches/route.ts](src/app/api/coaches/route.ts)) — response becomes `{ email, initialPassword }`.
- `POST /api/students` ([students/route.ts](src/app/api/students/route.ts)) — response becomes `{ id, initialPassword }`, `initialPassword` only set when an email was provided.

**UI — `src/components/credentials-reveal-card.tsx`** (new, shared): small presentational component taking `{ email, password }`, rendering both in monospace with a copy-to-clipboard button per field (`navigator.clipboard.writeText`) and a "סגור" button. Used by both dialogs below instead of duplicating the same markup twice.

**`AddCoachDialog` / `AddStudentDialog`**: add local state for `createdCredentials: { email: string; password: string } | null`. On mutation success, if `initialPassword` is present, set this state instead of immediately closing the dialog — the dialog body swaps to `<CredentialsRevealCard>`. If `initialPassword` is `null` (re-add of an existing account), keep today's behavior (toast + close). Closing the reveal card (or the dialog) clears the state and resets the form as today.

## 2. Login page

**`src/app/login/page.tsx`**:
- Rename `StaffLoginForm` → `EmailPasswordLoginForm` (it's no longer staff-specific) and remove the "kept for potential future use" comment.
- Delete `StudentLoginForm` entirely (the `signInWithOtp`/`verifyOtp` email-code flow) — no longer reachable from any tab.
- `LoginTabs`:
  - `tab === "staff"`: default renders `WhatsAppLoginForm`; add a text-button below it, "כניסה עם מייל וסיסמה", that swaps to `EmailPasswordLoginForm` (mirrors the existing WhatsApp-toggle pattern already used on the student tab today).
  - `tab === "student"`: default renders `EmailPasswordLoginForm`; keep the existing "כניסה עם WhatsApp" toggle button, still swapping to `WhatsAppLoginForm`.
- No change to `HashSessionHandler`, `auth/callback`, middleware, or `getUserRole` — `EmailPasswordLoginForm` calls `supabase.auth.signInWithPassword` client-side exactly as `StaffLoginForm` did, and role-based redirect after login is already handled by each protected layout.

## 3. Self-service password change

- **`src/components/profile-card.tsx`**: add a "שינוי סיסמה" outline button (next to the existing "התנתקות" button) that navigates to `/set-password`. Extend the `role` label switch to include `student` → "מתאמן" (currently only handles `admin`/falls through to "מאמן").
- **`src/app/(student)/student/profile/page.tsx`** (new): mirrors the existing admin/coach profile pages — fetch user + role server-side, render `<ProfileCard email={...} role="student" />`.
- **`src/components/nav-items.ts`**: add `{ href: "/student/profile", label: "פרופיל", icon: "User" }` to `STUDENT_NAV`.
- `/set-password` itself is unchanged — it already works correctly for an authenticated session (this was never the broken part of the old flow).

## Error handling

- `generateInitialPassword` / `createUser` failures on the coach/student creation path: if `createUser` returns an unexpected error (not "already exists"), surface it the same way `db_upsert_failed` errors are surfaced today (thrown, caught by the API route, returned as a 500 with message, shown via toast) rather than silently swallowed — only the "already exists" case is intentionally ignored.
- Clipboard copy failures (`navigator.clipboard` unavailable/denied) — non-fatal, no error UI needed; the password is still visible as plain text for manual copying.

## Testing

- Manual: add a new coach → dialog shows credentials card → copy works → log out → log in with email+password on staff tab → lands on `/admin` or `/coach` per role.
- Manual: add a new student (with email) → same flow → log in with email+password on student tab.
- Manual: add a student without email → no credentials card shown, no error.
- Manual: re-add an existing coach (edit flow uses `updateCoach`, but re-triggering `appendCoach` with the same email via upsert) → no credentials card, no error toast.
- Manual: WhatsApp OTP login still works unchanged on both tabs via the toggle.
- Manual/regression: trigger the CRM webhook for a new student — `upsertStudentFromCrm` behavior is unchanged (no `provisionStudentAuthUser` call), student logs in via WhatsApp OTP as before.
- Manual: profile → "שינוי סיסמה" → `/set-password` → new password works on next login, for admin, coach, and student.
