# Loyalty Program ("נוסע מתמיד") — Design Spec

Date: 2026-08-24

## Purpose

Give the academy a loyalty/status program for students: tiers with
increasing benefits, an admin-managed tier catalog, manual per-student tier
assignment, and a way for students to see their status and request that a
benefit be redeemed.

## Scope for This Iteration (V1)

Everything except **automatic** tier calculation. There's currently no
reliable field for "date joined" or per-student total spend in the data
model, and how exactly to measure "seniority" (tenure vs. money spent vs.
both) hasn't been decided yet. Rather than block the whole feature on that
open question, V1 ships with:

- Admin manually creates/edits/deletes tiers (name, human-readable
  requirement description, benefit description).
- Admin manually assigns a tier to each student.
- Full student-facing display, redemption requests, and redemption history.

Automatic tier calculation/promotion based on tenure and/or spend is an
explicit future enhancement, once the measurement question is resolved —
not part of this spec.

## Data Model

### New table: `loyalty_tiers`

| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | e.g. "כסף" |
| requirement_description | text | free text written by the admin, e.g. "וותק 6+ חודשים / מעל 3,000 ₪" — descriptive only, not a computed rule |
| benefit_description | text | free text, e.g. "5% הנחה על אימונים פרטיים" |
| sort_order | int | determines ladder position, lowest to highest |
| created_at | timestamptz, default now() | |

Admin has full CRUD over this table (add/edit/delete tiers), the same way
groups and pricing are managed today.

### `students` table

New nullable column: `loyalty_tier_id` (FK to `loyalty_tiers`, nullable —
`null` means "not yet assigned to a tier"). Set by the admin the same way
`subscription_type` is set today, via the existing student-edit dialog.

### `contact_requests` table (existing — reused, not replaced)

This table already has exactly the shape needed for redemption requests:
`id`, `student_id`, `subject`, `message`, `status`, `created_at`. No new
table for redemptions.

- A redemption request is inserted with `subject: "מימוש הטבה"` and a
  `message` auto-composed from the tier name + benefit description — through
  the existing `insertContactRequest` function, so it shows up in the
  existing admin "פניות" list with zero changes needed there beyond what's
  described below.
- `status` is widened from `"new" | "read"` to `"new" | "read" | "approved"`.
  **Implementation note:** verify whether the DB has a `CHECK` constraint
  restricting `status` to its current two values (this table predates the
  tracked migrations folder, so its exact current schema needs to be
  confirmed against the live Supabase instance before writing the migration
  to add `"approved"`).
- Only rows with `subject = "מימוש הטבה"` are ever expected to reach
  `"approved"` — regular contact requests keep using `"new"`/`"read"` exactly
  as today.

## Admin UI

### `/admin/loyalty` (new page, new "נוסע מתמיד" item in `ADMIN_NAV`)

List of all tiers ordered by `sort_order`, each showing name, requirement
description, benefit description, with edit/delete actions and a "דרגה
חדשה" button to add one — following the same list/dialog pattern already
used for groups and pricing.

### Assigning a tier to a student

A new "דרגת נאמנות" `Select` field inside the existing
`edit-student-dialog.tsx`, alongside the existing fields like
`subscription_type` — populated from `loyalty_tiers`, plus a "ללא דרגה"
option that clears `loyalty_tier_id`.

### Approving a redemption request

In the existing `AdminMessages` component (`/admin/messages`, "פניות"):
when an expanded request's `subject` is exactly `"מימוש הטבה"` and its
status isn't already `"approved"`, show an additional "אשר מימוש" button
(alongside the existing auto-mark-as-read-on-expand behavior). Clicking it
sets `status: "approved"` and the card shows a "מומש ✓" badge. Requests with
any other subject are completely unaffected — no visible change for them.

## Student UI

### `/student/loyalty` (new page, new "נוסע מתמיד" item in `STUDENT_NAV`)

- **Tier ladder**: every tier from `loyalty_tiers`, ordered by `sort_order`,
  each showing its name, requirement description, and benefit description.
  The student's current tier (via `students.loyalty_tier_id`) is visually
  highlighted within the ladder (e.g. a badge/prominent border) — so the
  student sees both where they stand and what upcoming tiers look like, even
  without a computed progress percentage (there is none yet in V1).
  - If the student has no tier assigned, the ladder still renders in full
    (so they can see what's achievable), with no tier highlighted and no
    redemption button shown.
- **"ממש הטבה" button**, shown next to the student's current tier (only
  when they have one): submits a redemption request via the existing
  contact-request mechanism, with a success toast ("הבקשה נשלחה"). No
  dedup/rate-limiting — it behaves exactly like submitting any other contact
  request, and can be clicked again if desired. The admin handles it
  manually from "פניות", same as any inquiry.
- **"הטבות שמימשת" (redemption history)**: below the ladder, a list of the
  student's own `contact_requests` rows where `subject = "מימוש הטבה"` AND
  `status = "approved"` — date + benefit description. Only
  admin-approved redemptions appear here, not every request the student has
  sent (a sent-but-not-yet-approved request doesn't show up in this list).
  Empty state if none yet.

### `/student` (dashboard) summary

A short existing-style card/summary near the top: current tier name (if
assigned) with a "לפרטים" link to `/student/loyalty`. Nothing shown (or a
neutral "טרם שויכה דרגה" note) if unassigned.

## API Surface (new)

- `GET/POST/PATCH/DELETE /api/admin/loyalty-tiers[/:id]` — admin-only CRUD
  for tiers.
- Extend the existing student-edit save path to accept `loyalty_tier_id`.
- Extend `PATCH /api/admin/messages` to accept an explicit target status
  (defaulting to today's "read" behavior when omitted, for backward
  compatibility) so it can also be used to set `"approved"`.
- New `GET /api/student/loyalty` — student-only, returns: all tiers (for the
  ladder), the student's current tier, and their approved redemption
  history (the `subject = "מימוש הטבה" AND status = "approved"` rows).
- Redemption reuses the existing `POST /api/student/contact` route as-is —
  the "ממש הטבה" button calls it with a fixed
  `subject: "מימוש הטבה"` and a `message` composed client-side from the
  student's current tier name + benefit description. No new route.

## Out of Scope (YAGNI)

- Automatic tier calculation/promotion (tenure and/or spend-based) — future
  enhancement, explicitly deferred per the open measurement question.
- In-app fulfillment of benefits (e.g. automatically discounting a price) —
  purely informational + a manual admin-fulfilled request, as today's
  payment flow is entirely manual too.
- Any tracking of "declined" redemption requests, or reasons — status only
  ever needs to reach `"approved"`; anything else stays `"new"`/`"read"`.
- Notifications (WhatsApp/email) when a tier changes or a redemption is
  approved — not requested, can be added later using the app's existing
  WhatsApp infrastructure if wanted.
- Historical tier-change tracking (when a student moved from one tier to
  another) — only the current tier is stored.
