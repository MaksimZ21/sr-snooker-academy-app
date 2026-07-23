# Email + Password Login — Design

Date: 2026-07-23

## Background

The app currently has two login mechanisms wired into `src/app/login/page.tsx`:
- Staff tab (מאמן/אדמין): WhatsApp OTP only.
- Student tab (מתאמן): email OTP (`supabase.auth.signInWithOtp`) by default, with a toggle to WhatsApp OTP.

An email+password flow (`StaffLoginForm`) already exists in the file but is unused — it was removed from the UI in commit `75effaf` after the invite-email flow that was supposed to provision passwords kept breaking (missing site URL, session not set server-side, swallowed invite errors, duplicate-user handling — five bugfix commits across two days before it was abandoned in favor of WhatsApp-only). `/set-password` (`supabase.auth.updateUser({password})` on an already-authenticated session) was never the broken part and still works today; it's just orphaned — nothing links to it.

**Rejected alternative — admin-generated initial passwords.** An earlier version of this design had the admin generate a random password on coach/student creation and hand it over manually. This breaks down for students created via the CRM webhook (`upsertStudentFromCrm`, in `src/app/api/webhooks/crm/route.ts`) — most students arrive this way, and it's an unattended path with no admin present to relay anything. Storing the generated password in the DB for later admin retrieval was considered and rejected (plaintext secret storage, goes stale the moment the user changes it, extra schema/UI for a niche need).

**Chosen approach — manual, admin-triggered invite email.** Reuse Supabase's own `inviteUserByEmail` (and `resetPasswordForEmail` as a fallback for accounts that already exist), implemented with the specific fixes already discovered and applied the first time around (see `d35895a`, `c502dc4`, `c0c153a`, `7857b44`), but **fired manually** by an admin clicking a button per coach/student row — not automatically at creation time, and not tied to WhatsApp at all. This:
- Solves the CRM case: the button lives on the admin's coaches/students list, so the admin can trigger it for any row whenever they want, including students that arrived automatically.
- Sends the email straight to the user — no secret ever passes through the admin or gets stored in our DB.
- Reuses the exact `/auth/callback?next=/set-password` → `/set-password` chain that already works correctly today.

## Scope

1. Login page: restore email+password as a login option on both tabs, alongside WhatsApp.
2. Admin-triggered "send invite link" action on coach and student rows.
3. Self-service password change, reachable from profile pages (including a new one for students).

Explicitly out of scope: any automatic/eager sending of invite emails on account creation, WhatsApp as a delivery channel for this feature, storing generated passwords anywhere, rate limiting beyond Supabase Auth's defaults.

## 1. Login page

**`src/app/login/page.tsx`**:
- Rename `StaffLoginForm` → `EmailPasswordLoginForm` (no longer staff-specific) and remove the "kept for potential future use" comment.
- Delete `StudentLoginForm` entirely (the `signInWithOtp`/`verifyOtp` email-code flow) — no longer reachable from any tab.
- `LoginTabs`:
  - `tab === "staff"`: default renders `WhatsAppLoginForm`; add a text-button below it, "כניסה עם מייל וסיסמה", that swaps to `EmailPasswordLoginForm` (mirrors the existing WhatsApp-toggle pattern already used on the student tab today).
  - `tab === "student"`: default renders `EmailPasswordLoginForm`; keep the existing "כניסה עם WhatsApp" toggle button, still swapping to `WhatsAppLoginForm`.
- No change to `HashSessionHandler`, `auth/callback`, middleware, or `getUserRole` — `EmailPasswordLoginForm` calls `supabase.auth.signInWithPassword` client-side exactly as `StaffLoginForm` did, and role-based redirect after login is already handled by each protected layout.

## 2. Admin-triggered invite link

**`src/lib/auth/invite.ts`** (new) — `sendLoginInvite(email: string): Promise<void>`:
```
const admin = createSupabaseAdminClient();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sr-snooker-academy-app.vercel.app";
const redirectTo = `${siteUrl}/auth/callback?next=/set-password`;
const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
if (error) {
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) throw new Error(`invite_failed: ${resetError.message}`);
}
```
`inviteUserByEmail` covers the common case (user has no password yet); falling back to `resetPasswordForEmail` on error covers re-sending to someone who already has an account (mirrors the `7857b44` fix). Real errors propagate (not swallowed), matching `c0c153a`.

**`POST /api/admin/invite`** (new route) — admin-only (`requireUser`, `role === "admin"`), body `{ email: z.email() }`, calls `sendLoginInvite`, returns `{ ok: true }` or a 500 with the error message on failure (same pattern as the existing coaches/students routes).

**UI** — one shared endpoint, used from both admin lists:
- **`src/components/coaches-list.tsx`** — add a "שלח קישור הזמנה" icon button (e.g. `Mail` from lucide-react) to `CoachRow`'s action group, next to edit/delete. `useMutation` posting to `/api/admin/invite` with `{ email: c.email }`; `toast.success("קישור נשלח")` / `toast.error(...)` on result.
- **`src/components/students-list.tsx`** — same button added to the equivalent per-row actions, using the student's email. If a student has no email, disable/hide the button (nothing to send to).
- Available on **every row**, not just newly-created ones — existing coaches/students who've only ever used WhatsApp can also be invited to set a password whenever the admin chooses to.

## 3. Self-service password change

- **`src/components/profile-card.tsx`**: add a "שינוי סיסמה" outline button (next to the existing "התנתקות" button) that navigates to `/set-password`. Extend the `role` label switch to include `student` → "מתאמן" (currently only handles `admin`/falls through to "מאמן").
- **`src/app/(student)/student/profile/page.tsx`** (new): mirrors the existing admin/coach profile pages — fetch user + role server-side, render `<ProfileCard email={...} role="student" />`.
- **`src/components/nav-items.ts`**: add `{ href: "/student/profile", label: "פרופיל", icon: "User" }` to `STUDENT_NAV`.
- `/set-password` itself is unchanged — it already works correctly for an authenticated session.

## Error handling

- `sendLoginInvite` failures (both `inviteUserByEmail` and the `resetPasswordForEmail` fallback erroring) surface as a real error message via the API route → toast, not swallowed.
- Student row invite button: no-op (disabled) when the student has no email on file, rather than calling the API with an empty string.

## Testing

- Manual: click "שלח קישור הזמנה" on a coach row → email arrives → link lands on `/set-password` (via `/auth/callback`) → set password → land on `/` → redirected to `/admin` or `/coach` per role.
- Manual: same for a student row, including one that was created via the CRM webhook (not the manual add dialog).
- Manual: click invite twice for the same person (second click exercises the `resetPasswordForEmail` fallback) → still lands on `/set-password` successfully.
- Manual: student with no email on file → invite button is disabled, no request fires.
- Manual: WhatsApp OTP login still works unchanged on both tabs via the toggle; CRM webhook student creation (`upsertStudentFromCrm`) is completely untouched by this feature.
- Manual: profile → "שינוי סיסמה" → `/set-password` → new password works on next login, for admin, coach, and student.
