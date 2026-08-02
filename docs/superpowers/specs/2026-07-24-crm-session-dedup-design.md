# Preventing Duplicate Sessions Between the App and the CRM — Design

Date: 2026-07-24

## Background

Sessions currently arrive from an external CRM via `POST/GET /api/webhooks/crm/training` (`event_created` → `upsertSessionFromCrm` in `src/lib/sheets/sessions.ts`), and are also created manually by the admin via the "הוסף מפגש" dialog (`src/components/forms/add-session-dialog.tsx` → `POST /api/sessions` → `appendSession`).

The admin has been manually pre-creating (duplicating) sessions in the app ahead of time for known recurring groups, so a coach and roster are already set up before the CRM's own event for that same class arrives. Today, `upsertSessionFromCrm` only recognizes an existing session by `crm_appointment_id` (or `crm_event_id` as a fallback) — identifiers that a manually-created session never has. So when the matching CRM event does arrive, it always creates a second, duplicate session instead of recognizing the one that already exists for the same class.

**Root cause found during investigation:** sessions don't record which group they belong to at all, on either the manual or CRM-created path. The "הוסף קבוצה שלמה..." picker in the add-session dialog only uses a group's roster/coach/time to *pre-fill* other fields — it doesn't persist a `group_id`. Similarly, `upsertSessionFromCrm` resolves the CRM's `meeting_title` to a `groups` row (fuzzy name match, already existing logic) purely to fill `student_ids`/`coach_email` — it never persists which group matched. This is the actual gap standing in the way of the feature, more than anything on the CRM side.

## Scope

1. Persist `group_id` on every session, however it's created (manual dialog or CRM webhook).
2. Extend `upsertSessionFromCrm`'s matching logic with a new fallback: when no `crm_appointment_id`/`crm_event_id` match is found, but the CRM's `meeting_title` resolves to a known group, look for an existing session with the same `group_id` + `date` + `start_time`. If found, treat it as the same session — attach the CRM identifiers to it without touching anything the admin already entered. Otherwise, create a new session exactly as today.

Explicitly out of scope: any change to how `appointment_approved`/`appointment_rejected` (attendance) webhooks match sessions — they already match purely by `crm_appointment_id`, which this feature ensures gets set correctly regardless of which path created the session, so no change is needed there. No change to coach-based matching (rejected during design — the CRM never asserts a coach, so building matching logic around `coach_email` would rely on an indirect, unreliable proxy instead of the field the CRM actually sends, `meeting_title`).

## 1. Data model: `group_id` on sessions

**New migration** `supabase/migrations/20260724_sessions_group_id.sql`:
```sql
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS group_id text;
```
Nullable, no default, no foreign key constraint (matches this codebase's existing convention of loosely-typed text IDs across tables, e.g. `coach_email` isn't FK-constrained to `coaches.email` either).

**`src/lib/sheets/schemas.ts` — `SessionRow`**: add `group_id: z.string().nullable().default(null)`, same shape as `last_payment_date` was added to `StudentRow`.

## 2. Manual creation persists `group_id`

**`src/components/forms/add-session-dialog.tsx`**:
- New state `groupId: string | null`, set inside `applyGroup(groupId)` (which already receives the selected group's id) alongside its existing side effects.
- Included in the `POST /api/sessions` body as `group_id: groupId`.
- Reset to `null` in `reset()`.
- If the admin creates a repeat series ("צור מספר מפגשים"), every date in the loop already reuses the same request body shape — `group_id` naturally carries through to every occurrence, no extra work needed.
- If no group was picked (e.g. `training_type === "private"`, where the group selector is hidden), `group_id` stays `null` — the new CRM-matching fallback simply won't find these sessions, which is correct, since a private lesson has no group to match against.

**`src/app/api/sessions/route.ts`**: add `group_id: z.string().nullable().optional()` to the POST body zod schema.

**`src/lib/sheets/sessions.ts` — `appendSession`**: accept `group_id?: string | null` in its input type, pass through to the insert (`group_id: input.group_id ?? null`).

## 3. CRM creation/update persists `group_id`

**`src/lib/sheets/sessions.ts` — `upsertSessionFromCrm`**: the existing group-resolution block already queries `groups` to fill `studentIds`/`resolvedCoachEmail` from a fuzzy match against `input.group_name`. Two changes:
- The `groups` select needs to include `id` (currently only selects `name, student_ids, coach_email`).
- Capture the matched group's `id` into a new local `resolvedGroupId: string | null`, and include `group_id: resolvedGroupId` in the `fields` object that both the "update existing" and "create new" branches already use — so `group_id` gets persisted on CRM-created/updated sessions the same way `crm_event_id` etc. already are, no separate write path needed.

## 4. The new matching fallback

Still in `upsertSessionFromCrm`, after the existing `crm_appointment_id` → `crm_event_id` lookup chain comes up empty (`existing === null`), and after `resolvedGroupId` has been computed: if `resolvedGroupId` is set, look for a session with `group_id = resolvedGroupId AND date = input.date AND start_time = input.start_time` (no constraint on `crm_appointment_id` — this is specifically meant to find a session that has none yet, i.e. was created manually in the app).

- **If found:** this is the "attach" case. Update *only* `crm_event_id`, `crm_appointment_id`, `crm_event_type`, and `group_id` (in case it wasn't set yet) on that session. Do **not** touch `date`, `start_time`, `end_time`, `training_type`, `address`, `student_ids`, or `coach_email` — those stay exactly as the admin entered them manually. Return `{ id, action: "attached" }` (a new third value alongside the existing `"created"`/`"updated"`, purely informational — surfaces in the webhook log so an admin auditing `/admin/webhook-logs` can tell "matched an existing manual session" apart from "created a brand new one").
- **If not found:** fall through to today's "create new" path unchanged (which now also sets `group_id` per section 3).

Matching is exact-string on `date` (`yyyy-MM-dd`) and `start_time` (`HH:MM`) — both sides derive from the same `groups` row (the admin's dialog pre-fills `start_time` from `group.start_time` when the group is picked; the CRM's `meeting_time` is parsed to the same `HH:MM` format), so this is expected to match reliably as long as neither the admin nor the CRM operator changes the time after the fact. A mismatch here just means the CRM creates a new session instead of attaching — a safe, non-destructive failure mode, not a crash — so no error handling is needed beyond that.

## Error handling

- If the `meeting_title` doesn't fuzzy-match any group (as can already happen today), `resolvedGroupId` stays `null` and the new fallback step is skipped entirely — behavior is identical to today's (create new, unless matched by CRM IDs).
- If more than one manually-created session happens to share the same `group_id` + `date` + `start_time` (e.g. an admin accidentally duplicated a session onto the same slot), the lookup should pick a single deterministic match (e.g. `.limit(1)` ordered by `id`) rather than erroring — a rare data-entry mistake shouldn't break the webhook. This is a known, accepted edge case; no dedup/cleanup tooling is being built for it.

## Testing

- Manual: create a session via "הוסף מפגש", picking a group, for a future date/time. Trigger the CRM's `event_created` webhook (via the existing GET/POST route) with a `meeting_title` that resolves to the same group and matching date/time. Confirm: no new session appears in `/admin/schedule`; the existing one gains a `crm_appointment_id` (visible via `/admin/webhook-logs`, `action: "attached"`); its start time, roster, and training type are unchanged from what was manually entered.
- Manual: same setup, but send a CRM date/time that doesn't match the manual session → confirm a second, new session is created (today's behavior, unaffected by this change).
- Manual: after an "attach", trigger `appointment_approved`/`appointment_rejected` for that appointment → confirm attendance is recorded against the manually-created session (proves the `crm_appointment_id` linkage works end-to-end).
- Manual: use "צור מספר מפגשים" to create a repeat series with a group picked → confirm every created session has the same `group_id` (spot check a couple via `/admin/sessions/[id]` or a direct DB query).
- Manual: create a private-lesson session (`training_type: "private"`, no group picker shown) → confirm `group_id` is `null` and a same-day CRM event for an unrelated group still creates a separate session as expected (no false-positive attach).
