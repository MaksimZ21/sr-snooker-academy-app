# Remove Inactive Student from WhatsApp Group — Design Spec

Date: 2026-08-29

## Purpose

Today, marking a student "לא פעיל" (inactive) in the edit-student dialog
only affects the app (excludes them from pickers/dashboards/portal login —
see the earlier answered question on this same topic). It has no effect on
WhatsApp. This adds an automatic best-effort attempt to remove the student
from their matching WhatsApp group the moment they're switched to
inactive, so staff don't have to remember to do it manually in WhatsApp.

## Scope

- Triggers only on the actual transition `active: true → false` (a
  student who's already inactive being re-saved does not re-trigger this).
- Never blocks or fails the "mark inactive" action itself — the student
  update always succeeds regardless of what happens with WhatsApp.
- Assumes (confirmed by the user) a student belongs to at most one
  internal `groups` row in practice; the implementation still handles
  multiple defensively, but this isn't a scenario that needs dedicated
  design/testing effort.
- No new WhatsApp group ↔ internal group mapping table — matches by name,
  since (per the user) the internal group's name and its WhatsApp group's
  name are "almost the same."
- No UI to review/undo — this is a one-shot, fire-and-forget side effect
  of saving the student as inactive.

## Mechanism

1. `updateStudent(id, input)` (`src/lib/sheets/students.ts`), when called
   with `input.active === false`, first reads the student's CURRENT
   `active` value. Only if it was `true` before this update does the
   WhatsApp removal attempt run — a normal re-save of an already-inactive
   student does nothing extra.
2. Find every internal `groups` row whose `student_ids` includes this
   student (existing `fetchGroupsAll()`).
3. If the student has no `phone` on file, or belongs to no group, stop
   here — nothing to remove.
4. Fetch live WhatsApp groups via the existing `getWhatsAppGroups()`
   (Green API). For each internal group the student belongs to, look for
   a WhatsApp group whose name loosely matches (case-insensitive,
   substring-tolerant in either direction — e.g. a WhatsApp group named
   "🎱 מכללת תל אביב 🎱" still matches an internal group named
   "מכללת תל אביب").
5. On the first match found, call a new Green API function,
   `removeWhatsAppGroupParticipant(groupId, phone)` (Green API's
   `removeGroupParticipant` endpoint — doesn't exist in
   `src/lib/whatsapp/greenapi.ts` yet, needs adding), and stop (don't also
   try other groups the student might belong to).
6. Any failure at any step (no phone, no group, no WhatsApp match, Green
   API error) is swallowed and treated the same way: "nothing removed."
   Nothing here ever throws back up to break the student save.

## API & UI

- `PATCH /api/students/[id]` (`src/app/api/students/[id]/route.ts`)
  returns the outcome alongside the existing `{ ok: true }`:
  `{ ok: true, whatsAppRemovalAttempted: boolean, removedFromWhatsAppGroup: string | null }`.
  - `whatsAppRemovalAttempted`: `true` only when this was a genuine
    active→inactive transition (i.e., the app actually tried).
  - `removedFromWhatsAppGroup`: the matched WhatsApp group's name on
    success, `null` otherwise (whether because nothing was attempted, or
    an attempt was made but nothing matched/succeeded).
- `src/components/forms/edit-student-dialog.tsx`'s save flow reads this
  response and shows one extra, low-key toast (separate from the existing
  "student updated" toast) only when `whatsAppRemovalAttempted` is `true`:
  - Matched and removed: "הוסר גם מקבוצת הוואטסאפ 'X'".
  - Attempted but nothing matched/succeeded: a quieter "לא נמצאה קבוצת
    וואטסאפ מתאימה להסרה" — informational, not styled as an error.

## Out of Scope (YAGNI)

- No handling for a student in multiple groups needing removal from more
  than one WhatsApp group — stops at the first match, per the confirmed
  real-world assumption that this doesn't currently happen.
- No stored WhatsApp-group-to-internal-group mapping — pure name matching,
  same trust model already used elsewhere in this app for WhatsApp group
  selection.
- No re-adding a student to WhatsApp automatically if they're later
  switched back to active — this is one-directional (removal only).
- No retry mechanism if the Green API call fails transiently — a single
  attempt, silently treated as "not removed" on any failure.
