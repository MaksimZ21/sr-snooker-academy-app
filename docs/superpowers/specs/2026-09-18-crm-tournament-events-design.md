# CRM Tournament Events Design Spec

Date: 2026-09-18

## Purpose

The CRM already sends calendar events into the schedule as `sessions` (see `src/app/api/webhooks/crm/training/route.ts`). Some of these calendar events are actually tournaments, not training sessions — the CRM marks this with `meeting_type` exactly equal to `"טורניר"`. When that happens, the event should become a real `regular` tournament (using the exact same Tournaments feature already built) instead of a session — appearing on the Schedule alongside sessions, and ready for an admin to fill in the manager afterward.

Separately, the CRM already sends `appointment_approved`/`appointment_rejected` events per person, keyed by `appointment_id` — today these only ever resolve against a session (marking attendance). When an `appointment_id` belongs to a tournament instead (someone bought a ticket to that tournament through the CRM), `appointment_approved` should add that person as a real tournament participant — joining the shared students/players table exactly like any other tournament participant, not a "local" one — instead of marking attendance.

## Data Model

### `tournaments` (existing table, modified)
| column | type | notes |
|---|---|---|
| event_date | date, nullable | only set for a tournament created from a CRM event — that's what makes it appear on the Schedule. A manually-created tournament never gets one and never appears on the Schedule. |
| crm_event_id | text, not null, default `''` | mirrors the identical column/convention already on `sessions` |
| crm_appointment_id | text, not null, default `''` | same idempotent-matching role it already plays for `sessions` — this is also the id that `appointment_approved`/`appointment_rejected` webhooks arrive with |
| crm_event_type | text, not null, default `''` | mirrors `sessions.crm_event_type` |

No new tables. `tournament_participants` needs no schema change — a CRM-ticket-bought participant is a completely normal `regular`-tournament participant (`student_id` set, `local_name` null), using the exact machinery already built for that.

## `event_created` — Creating the Tournament

In `src/app/api/webhooks/crm/training/route.ts`, `handleEventCreated` currently always calls `upsertSessionFromCrm`. It now branches first on `meeting_type`:

- `meeting_type === "טורניר"` → calls a new `upsertTournamentFromCrm` instead (never creates a session for this event).
- anything else → unchanged, existing session flow.

`upsertTournamentFromCrm(input: { crm_event_id, crm_appointment_id?, name?, event_date, crm_event_type? })`:
- Resolves an existing tournament the same way `upsertSessionFromCrm` resolves an existing session: by `crm_appointment_id` when present, else by `crm_event_id` — so a webhook retry for the same CRM event updates that same tournament rather than duplicating it. Two different CRM events (different ids) always produce two separate tournaments — there's no cross-event grouping.
- Creates with `type: "regular"`, `manager_email: null` (no manager yet — see "Filling in the manager" below), `name: input.name?.trim() || "טורניר"` (mirrors the `meeting_title || meeting_type` fallback pattern `upsertSessionFromCrm` already uses; falls back to the literal word "טורניר" since that's always a truthful placeholder name here), `handicap_points_per_rating_gap` left at its normal default (20 — nothing CRM-specific about it), `public_slug` generated as normal.
- Does not touch group/pricing resolution at all — none of that concept exists for tournaments.

`meeting_title || meeting_type` already flows in as `input.name` from the same place `handleEventCreated` currently builds it for sessions — no change needed to how the route extracts that value, only to which function it's handed to.

## `appointment_approved` — Adding a Paid Participant

`handleAppointmentApproved` currently does exactly one lookup: `fetchSessionByCrmAppointmentId`. It now tries that first as today, and when it comes back empty, tries a new `fetchTournamentByCrmAppointmentId(appointment_id)` before giving up:

- **Session found** → unchanged, existing attendance-confirmation flow.
- **No session, tournament found** → resolve the person by phone using the exact same `findStudentByPhone` helper already in this file, then call a new `addTournamentParticipantFromCrm(tournamentId, { studentId, firstName, lastName, phone })`:
  - If a student was found by phone: ensure their `public_slug` exists (`ensurePlayerSlug`, same lazy-slug logic every other tournament-join path already uses), then insert a `tournament_participants` row for them with `paid: true` (they paid for this via the CRM — that's the whole point of this event firing).
  - If no student was found by phone: create one via `appendStudent` (`first_name`, `last_name`, `phone`, `active: false`, `is_tournament_only: true`, `rating: 1000`, a generated `public_slug`) — this is the "join the general players list" the CRM ticket buyer gets — then insert the participant row the same way, `paid: true`.
  - Idempotent: a duplicate `appointment_approved` delivery for someone already registered is not an error — caught and reported as a no-op, not surfaced as a failure (matches the unique constraint on `(tournament_id, student_id)` already enforced by the schema).
- **Neither found** → unchanged, existing "warning: session not found" response.

## `appointment_rejected` — Explicitly Ignored for Tournaments

No new behavior. When the appointment doesn't resolve to a session, this handler does **not** attempt a tournament lookup at all — a rejected/cancelled ticket purchase for a tournament is a deliberate no-op, not something this feature reacts to. The existing "session not found" response is what a tournament-linked `appointment_rejected` will get, and that's fine — logged and ignored, matching the explicit product decision that a rejection needs no tournament-side effect (no removal, no unpaid flag, nothing).

## Schedule Integration

`WeeklyGrid` (shared by `/admin/schedule` and `/coach/schedule`) fetches sessions for the visible week today. It now also fetches tournaments whose `event_date` falls in that same range, from a new `GET /api/tournaments/week?start=...&end=...` route (mirrors `GET /api/sessions/week`'s shape; role-gated the same as the existing `GET /api/tournaments` — any admin or coach sees every tournament, no manager-based filtering, since Tournaments already has no such restriction on viewing). Only CRM-created tournaments (the ones with an `event_date`) are ever returned — a manually-created tournament has no `event_date` and never appears here.

On each day cell, tournament cards render alongside session cards (not instead of them) — a new `TournamentScheduleCard`, visually distinct from `SessionCard` (its own stripe color, a trophy icon, a "טורניר" label), linking to `/${basePath}/tournaments/${id}`.

## Filling In the Manager — a New "Edit Tournament" Capability

Today there is no way to edit a tournament's details after creation at all — not from the CRM, not by hand. This is a real, standing gap, and it's the only way a CRM-created tournament (which starts with no manager) ever gets one assigned. A new admin-only "ערוך טורניר" action on the tournament detail page opens a dialog to edit `name`, `manager_email` (only relevant for a `regular` tournament — hidden for `multi_location`, matching the create dialog's existing pattern), `rules_url`, and `handicap_points_per_rating_gap` (also `regular`-only) — calling the existing `PATCH /api/tournaments/[id]` route, which already validates and supports every one of these fields; only the UI to reach it is new.

A `regular` tournament with no manager yet (`manager_email` is null) shows a visible cue in its header — e.g. "⚠️ טרם הוגדר מאמן אחראי" — so an admin opening it knows there's something to fill in. This isn't CRM-specific: the same cue and edit dialog apply to any regular tournament missing a manager, for whatever reason.

## Explicitly Out of Scope (YAGNI)

- No "attach to a manually-created tournament matching the same date" logic (unlike `upsertSessionFromCrm`'s group/date/time attach-to-existing-manual-session behavior) — not requested, and there's no obvious matching key (tournaments have no group concept).
- No handling of `appointment_rejected` for tournaments beyond doing nothing — confirmed explicitly.
- No editing capability for `type` (still immutable after creation, unchanged from the existing rule) or for the CRM linkage fields themselves.
- No UI to manually set a tournament's `event_date`/CRM fields by hand — these only ever come from the webhook.
