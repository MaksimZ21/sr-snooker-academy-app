# Group → Future Sessions Membership Sync — Design Spec

Date: 2026-08-16

## Problem

A session created from a group snapshots that group's `student_ids` at
creation time (`group_id` links back to the group, but the roster itself is
copied). When a student is later added to or removed from the group itself
(via `/admin/groups`, or automatically via the CRM college-group flow),
already-created sessions tied to that `group_id` don't reflect the change.
Today the only fix is manual: open the session's "ניהול מתאמנים" dialog and
re-apply the group.

## Goal

Whenever a group's membership changes, automatically propagate that specific
change (who was added, who was removed) to that group's **future** sessions —
forward only, never touching sessions that have already happened.

## Scope

- Affected sessions: `group_id = <the group>` AND `date >= today` AND
  `status != "cancelled"`.
- Past sessions and cancelled sessions are never modified — history stays
  intact.
- The sync is surgical: it adds/removes exactly the student IDs that changed
  on the group, and leaves the rest of a session's roster untouched. This
  matters because a session can already have extra students manually added
  for makeup training (via the existing "ניהול מתאמנים" roster dialog) who
  aren't part of the group at all — the sync must not remove them.
- A newly created group (`appendGroup`) never needs syncing — it has no
  sessions yet.
- Backend-only change. No UI changes — admins keep editing groups exactly as
  today; the propagation happens behind the scenes.

## Implementation

### New function: `syncGroupMembershipToSessions`

In `src/lib/sheets/groups.ts` (or a shared location if cleaner):

```
syncGroupMembershipToSessions(groupId: string, added: string[], removed: string[]): Promise<void>
```

- Fetches sessions where `group_id = groupId AND date >= <today, ISO> AND
  status != 'cancelled'`.
- For each session: adds any id in `added` not already present in
  `student_ids`, removes any id in `removed` that is present. Only sessions
  whose roster actually changes are written.
- Calls the existing `invalidateSessions()` at the end so cached session
  lists (today/week/etc.) reflect the change immediately.

### Call sites

1. **`updateGroup()`** — currently overwrites `student_ids` wholesale. Changed
   to first read the group's current `student_ids` from the DB, diff against
   the incoming list (`added` = in new not in old, `removed` = in old not in
   new), perform the update, then call
   `syncGroupMembershipToSessions(id, added, removed)`.
2. **`ensureStudentInCollegeGroup()`** — already adds one student at a time.
   After it writes the updated `student_ids`, call
   `syncGroupMembershipToSessions(groupId, [studentId], [])`. Covers both the
   automatic CRM path (student upsert with a college) and the manual
   "סנכרן קבוצות מכללה" bulk-sync button, since both funnel through this
   function.

### Error handling

Follows existing route conventions — the sync runs inside the same
try/catch as the rest of the group update; a failure surfaces as a 500 to the
admin UI like any other write failure (no silent partial-failure swallowing).

## Out of Scope (YAGNI)

- No UI indicator showing "this session was auto-updated by a group change."
- No sync on group deletion (deleting a group doesn't currently touch
  sessions either — out of scope here, unchanged behavior).
- No retroactive backfill for past sessions — explicitly forward-only per
  product decision.
