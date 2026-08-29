# Session Auto-Pricing — Design Spec

Date: 2026-08-29

## Purpose

Every session has a `price_nis` field, but nothing in the app has ever set
it — not manual session creation, not the CRM webhook. It's always been
null/0, which is why the coach salary reports built earlier show 0/— across
the board. This adds a rule-based way to automatically price a session by
matching a keyword against its name (e.g. "מכללה" → 150 ₪, "אירוע הכרות" →
150 ₪), with the rules themselves managed by the admin in a new screen —
plus a manual override that's protected from ever being silently
overwritten by the automatic rule.

## Scope

- New admin-managed rules table: each rule is a keyword + a price. If a
  session's `name` contains a rule's keyword (case-insensitive substring
  match), that rule's keyword also becomes the session's `source` value
  and its price becomes the session's `price_nis` — reusing the `source`
  field/UI (מכללה / אירוע הכרות badges) that the coach salary/session
  screens already display but which nothing has ever populated until now.
- Applies automatically **only to sessions created/updated via the CRM
  webhook** (`upsertSessionFromCrm`), because that's the only session-
  creation path that has a `name` to match against today. Manually-created
  sessions (the "הוסף מפגש" dialog) don't collect a name field and are out
  of scope for auto-matching — an admin can still set their price manually
  after creating them.
- A manual price edit (in the existing edit-session dialog) always wins:
  once an admin sets a price by hand, that session is flagged so the
  automatic rule never overwrites it again — including on a later CRM
  re-sync of the same session, and including if the rules or the session's
  name change afterward.
- No new admin UI button to bulk-apply the rule to already-existing
  sessions. That's a one-time backfill Claude will run directly (reusing
  the same matching logic against the live database) once the admin has
  filled in the rules screen — not a shipped, permanently-visible feature.
- Seed data: two rules are created as part of this rollout —
  `"מכללה"` → 150 ₪ and `"אירוע הכרות"` → 150 ₪ — so the feature is
  useful immediately; the admin can add/remove rules afterward from the
  new screen.

## Mechanism

**New table `session_pricing_rules`:** `id`, `label` (the keyword to match
AND the source value it produces, e.g. `"מכללה"`), `price_nis`,
`created_at`.

**New column on `sessions`:** `price_manual boolean not null default
false`. Set to `true` whenever a price is saved through the manual edit
form. The automatic rule only ever writes `source`/`price_nis` on a
session where this is `false`.

**New pure matching function** (`src/lib/sheets/session-pricing.ts`):
`resolveSessionPricing(name, rules)` — returns the first rule whose
`label` appears (case-insensitively) in `name`, or `null` if none match.
Alongside it, the usual data-layer functions for the new table: fetch all
rules, add a rule, delete a rule.

**Hook-in point:** `upsertSessionFromCrm` (`src/lib/sheets/sessions.ts`)
fetches the rules, resolves a match against the session's `name`, and —
only when the session doesn't already have `price_manual: true` — includes
the matched `source`/`price_nis` (or leaves them untouched if nothing
matched) in both the create and update paths.

**Manual override:** the edit-session dialog gets a "מחיר (₪)" field.
Saving it calls the existing `PATCH /api/sessions/[id]`, extended to
accept `price_nis` and to always set `price_manual: true` whenever
`price_nis` is present in the request — this flag is never client-
controlled directly, only implied by the act of editing the price.

**New admin screen** `/admin/session-pricing`: a simple table + add-row
form (mirroring the existing `/admin/pricing` screen's look), plus a
delete button per row (the existing rate-card screen doesn't have delete,
but this table drives real automatic financial output, so mistakes need
to be correctable).

**One-time backfill (not a shipped feature):** after the admin fills in
the rules screen, Claude will run the same `resolveSessionPricing` logic
directly against existing sessions where `price_manual` is `false`,
updating their `source`/`price_nis`. This happens once, on request — it
is not exposed as a button or endpoint that lingers in the product.

## Out of Scope (YAGNI)

- No name field added to the manual "הוסף מפגש" dialog — auto-pricing
  only reacts to CRM-created/updated sessions for now.
- No way to "un-lock" a manually-priced session back to automatic — an
  admin who wants to go back to the rule's price just re-enters that
  number by hand.
- No changes to the existing `/admin/pricing` rate-card screen — it stays
  exactly what it is today (a reference list for coaches), unrelated to
  this new rules table.
- No coach-facing view of the pricing rules — this is an admin-only
  financial configuration screen.
- No changes to the hardcoded "מכללה"/"אירוע הכרות" badge styling or the
  session-list source filter — they already have a safe fallback for any
  other `source` value, so new rule labels beyond these two will still
  display, just without special-cased colors, until/unless asked for.
