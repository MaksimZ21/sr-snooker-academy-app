# Intro Events ("אירועי היכרות") Design Spec

Date: 2026-10-27

## Purpose

The CRM sends calendar events into the schedule as `sessions` by default (see `src/app/api/webhooks/crm/training/route.ts`), with one existing exception: an event whose `meeting_type` is exactly `"טורניר"` becomes a `tournaments` row instead (see `2026-09-18-crm-tournament-events-design.md`). A second kind of calendar event needs the same treatment: an **intro event** ("אירוע היכרות") — a trial/meet-and-greet session the academy runs for prospective students, who register through the CRM by name and phone (usually not existing students yet).

Today an intro event falls through to the default and becomes a `group`-type session — wrong label/color on the Schedule, no coach assigned, no roster (the CRM-provided name never matches a real `group`). There's also no way to record what the academy learns about each attendee: their snooker experience level and what they want to get out of the event. This spec adds a new, independent entity — `intro_events` — modeled closely on how CRM tournaments already work, with its own CRM intake, a manual-add option, a detail page, and a Schedule card.

**Out of scope for this spec:** scheduling league matches onto the weekly Schedule (a separate, previously-discussed idea) — not part of this round of work.

## Data Model

### `intro_events` (new table)
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text, not null | from CRM `meeting_title \|\| meeting_type`, same fallback pattern `upsertSessionFromCrm`/`upsertTournamentFromCrm` already use |
| event_date | date, not null | |
| start_time | text, not null, default `''` | from CRM `meeting_time`, parsed the same way `handleEventCreated` already parses it for sessions |
| coach_email | text, nullable, default null | the "מאמן אחראי" — always null on creation, filled in by an admin afterward, exactly like a CRM tournament's `manager_email` |
| crm_event_id | text, not null, default `''` | |
| crm_appointment_id | text, not null, default `''` | |
| crm_event_type | text, not null, default `''` | |
| created_at | timestamptz, default now() | |

Idempotent matching (`crm_appointment_id` first, `crm_event_id` fallback) mirrors `upsertTournamentFromCrm` exactly, including the unique-index-race fallback for a concurrent duplicate delivery.

### `intro_event_participants` (new table)
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| intro_event_id | uuid, FK → `intro_events`, `ON DELETE CASCADE` | |
| student_id | uuid, FK → `students` | always resolves to a real `students` row — a CRM registrant or manually-added new name gets one created via `appendStudent` with `is_tournament_only: true`, same "non-enrolled, event-only person" convention tournaments and leagues already use (the flag name is a pre-existing misnomer, not something this spec renames) |
| experience_level | text, nullable, default null | enum, see below |
| goal | text, nullable, default null | enum, see below |
| created_at | timestamptz, default now() | |

Unique constraint on `(intro_event_id, student_id)` — same duplicate-registration protection `tournament_participants` already has.

```ts
export const INTRO_EXPERIENCE_LEVELS = ["none", "hobbyist", "regular"] as const;
// none → "ללא ניסיון בכלל", hobbyist → "שחקן חובבן", regular → "שחקן קבוע"

export const INTRO_GOALS = ["cue_control", "technique", "angles", "beat_friend", "advance", "basics"] as const;
// cue_control → "שליטה בלבן", technique → "טכניקה", angles → "זוויות",
// beat_friend → "לנצח חבר/ים", advance → "להתקדם מקצועית", basics → "בסיס של הבסיס"
```

Both fields start `null` and are filled in by an admin by hand, per participant, whenever — not required at registration time (mirrors how `tournament_participants.skill_level` already works: nullable, admin-set later via a `Select`).

## `event_created` — Creating the Intro Event

In `handleEventCreated`, alongside the existing `meeting_type === "טורניר"` branch, add:

- `meeting_type` matching "אירוע היכרות" → calls a new `upsertIntroEventFromCrm` instead of `upsertSessionFromCrm`. The CRM actually sends `"אירוע היכרות"` (seen in a real webhook log 2026-10-28; an earlier exact-match on `"אירוע הכירות"` missed it and created a group session instead). The match ignores yuds and extra whitespace so היכרות / הכירות / הכרות all count.
- Everything else unchanged.

`upsertIntroEventFromCrm(input: { crm_event_id, crm_appointment_id?, name?, event_date, start_time, crm_event_type? })` follows `upsertTournamentFromCrm`'s structure: resolve-existing-by-CRM-id, insert-or-update, race fallback on `23505`, then drain any pending registrations parked for this `appointment_id`.

## `appointment_approved` — Adding a Participant

`handleAppointmentApproved` currently tries session, then tournament. Add a third fallback: `fetchIntroEventByCrmAppointmentId(appointment_id)`.

- **Session found** → unchanged.
- **No session, tournament found** → unchanged.
- **No session, no tournament, intro event found** → call a new `addIntroEventParticipantFromCrm(introEventId, { firstName, lastName, phone })`, mirroring `addTournamentParticipantFromCrm`: resolve by phone via the existing `findStudentByPhone`/`findStudentIdByPhone` helper, or create a new `is_tournament_only` student; insert the `intro_event_participants` row (no `paid` concept here — just `student_id`, `experience_level: null`, `goal: null`). Idempotent the same way (`23505` → `already_registered`, not an error).
- **None found** → unchanged: park via the existing generic `queuePendingRegistration(appointmentId, {...})` (the `crm_pending_registrations` table is already keyed only by `appointment_id`, with no entity-type concept — safe to reuse as-is here, since a given `appointment_id` only ever resolves to exactly one of session/tournament/intro-event, never more than one). `upsertIntroEventFromCrm` drains it the same way `upsertTournamentFromCrm` already does, just calling `addIntroEventParticipantFromCrm` instead.

## `appointment_rejected` — Explicitly Ignored

Same decision already made for tournaments: no intro-event lookup attempted here at all. A rejected registration is a deliberate no-op.

## Manual Add

On the intro event detail page, an admin-only "הוסף משתתף" control — same pattern as tournament/league participant add: pick an existing student, or type a new name (creates one with `is_tournament_only: true`, same as the CRM path).

## Schedule Integration

`WeeklyGrid` gains a third parallel fetch — `GET /api/intro-events/week?start=...&end=...` (mirrors `GET /api/tournaments/week`: admin/coach only, no manager-based filtering, since there's no such concept here either). Cards render alongside session and tournament cards on each day, via a new `IntroEventScheduleCard` — its own stripe color/icon, distinct from both `SessionCard` and `TournamentScheduleCard` — linking to `/${basePath}/intro-events/${id}`.

## Pages

- `/admin/intro-events` — list (name, date, coach, participant count).
- `/admin/intro-events/[id]` — detail: event name as the page title, a "מאמן אחראי" picker (same edit-affordance pattern as the tournament "ערוך טורניר" dialog — admin-only, since this starts empty from CRM), and a participant table: name, `experience_level` `Select`, `goal` `Select`, each auto-saving on change (optimistic mutation, same pattern already used throughout tournaments/leagues).
- Coach pages reuse the same detail view read-only (sees the card on `/coach/schedule`, can open it, cannot edit anything) — matches the admin-only decision already made for league match results, explicitly extensible later the same way.
- Nav: new "אירועי היכרות" item for admin (coach reaches it only via the Schedule card, no dedicated nav entry, matching how coaches reach tournaments today).

## Explicitly Out of Scope (YAGNI)

- League match scheduling — separate, not part of this spec.
- Coach-editable participant fields or coach-assignable "מאמן אחראי" — admin-only for now, per explicit decision, extensible later.
- `appointment_rejected` handling for intro events.
- Any "attach to a manually-created intro event matching the same date" logic — not requested.
- A "completed" status or any lifecycle beyond existing — not requested.
- Editing CRM-linked fields (`event_date`, `start_time`, CRM ids) by hand — CRM-only, like tournaments.
