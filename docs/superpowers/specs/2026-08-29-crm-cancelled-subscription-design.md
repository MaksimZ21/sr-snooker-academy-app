# CRM Cancelled/Frozen Subscription → Auto-Inactive — Design Spec

Date: 2026-08-29

## Purpose

The CRM webhook payload can include a `group_name` field. When its value is
`"מנויים מבוטלים"` (cancelled subscriptions) or `"מנויים מוקפאים"` (frozen
subscriptions), the student behind that webhook call should be
automatically marked inactive in the app — today nothing reacts to this
signal at all, so staff have to notice and toggle it by hand.

This is explicitly meant to compose with
`docs/superpowers/specs/2026-08-29-inactive-student-whatsapp-removal-design.md`:
once a student is marked inactive by this mechanism, the exact same
active→inactive transition that spec describes should fire, including the
WhatsApp-group removal attempt — no separate/duplicate logic here for
that part.

## Scope

- Only reacts to `group_name` being present and equal (after trimming) to
  one of the two known values. Any other value (including absent) is
  ignored — `group_name` isn't used for anything else today, so there's no
  risk of misinterpreting an unrelated value.
- No distinction is made between "cancelled" and "frozen" — both simply
  result in `active: false`. This app has no richer subscription-status
  concept than the existing `active` boolean, and none is being added here.
- No explicit skip of the existing `college_group`/`college_name`
  group-assignment logic — per product decision, the normal flow runs as-is.
  In practice this is a non-issue: a cancellation webhook's `college_group`
  value has been observed to arrive as the CRM's literal, unresolved
  template placeholder text (`"{college_group}"`, not a real value) — see
  "Placeholder handling" below, which makes this resolve itself cleanly
  rather than by coincidence.
- Applies to both new students (created via this webhook for the first
  time already cancelled/frozen) and existing students (an active student
  whose subscription is later cancelled/frozen).

## Placeholder handling (small related fix)

The example payloads show CRM fields that aren't relevant to a given event
sent as unresolved template text, e.g. `"birthday": "{birthday}"`,
`"college_group": "{college_group}"`. `birthday` already degrades safely
today (`parseBirthday` regex-validates `DD/MM/YYYY` and returns `null` for
anything else, including a stray `{birthday}`). `college_group`/
`college_name` have no equivalent guard. Add one: any incoming value
matching `/^\{.*\}$/` (the CRM's own placeholder syntax) is treated as
"not provided" — same as if the field were omitted — before it reaches the
group-matching logic. This prevents a literal `"{college_group}"` string
from ever being used as if it were a real group name.

## Mechanism

1. `CrmQuery` (`src/app/api/webhooks/crm/route.ts`) gains
   `group_name: z.string().optional()`.
2. `CrmStudent` (`src/lib/sheets/students.ts`) gains `group_name?: string`.
3. In `upsertStudentFromCrm`, before creating/updating the row, compute:
   ```ts
   const cancelledOrFrozen =
     input.group_name?.trim() === "מנויים מבוטלים" ||
     input.group_name?.trim() === "מנויים מוקפאים";
   ```
   When `true`, the student is created/updated with `active: false`
   (overriding the normal default of `active: true` for a brand-new
   student, and explicitly setting it for an existing one).
4. For an EXISTING student, this write must go through the same
   transition-detection path used by `updateStudent()` (per the companion
   spec) — not a separate raw `db.update(...)` call — so the WhatsApp
   removal side effect fires correctly here too, without duplicating that
   logic. The two specs' implementation plan should share one code path
   for "this student just became inactive, react to it."

## Out of Scope (YAGNI)

- No way to reverse this automatically if the CRM later reports the
  subscription reactivated — the CRM doesn't currently send such a signal,
  and un-cancelling is already a manual admin action today (toggle back to
  active) which remains the way to undo this.
- No admin-facing notification/alert list of "students auto-deactivated by
  CRM" beyond what the existing `/admin/webhook-logs` page already shows
  (the webhook's logged `result`, which will reflect the resulting
  `active` state via the same response shape the companion spec defines).
- No generalized placeholder-stripping across every CRM field — scoped
  specifically to `college_group`/`college_name`, the two fields this
  mechanism's group-matching logic actually reads.
