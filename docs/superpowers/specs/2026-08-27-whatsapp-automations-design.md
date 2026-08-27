# WhatsApp Automations (Multi-Step Schedule Sequences) — Design Spec

Date: 2026-08-27

## Purpose

The admin repeats a manual multi-step routine on WhatsApp: e.g. sending an
"open" message and opening the group's send permissions at 19:00, then
sending a "closing" message and closing the group again at 21:00 — each
step scheduled by hand, every time. This adds "automations": a saved,
reusable sequence of timed steps that gets applied in one action, creating
all the underlying scheduled messages/actions at once.

This is distinct from the WhatsApp message templates feature shipped
earlier (`docs/superpowers/specs/2026-08-27-whatsapp-templates-design.md`)
— that reuses message *text*; this reuses a *sequence of scheduled actions*.
They don't depend on each other.

## Scope (V1)

- A step's type is either a plain text message or a group-settings change
  (open/close) — the same two step kinds the admin's real routine uses.
  Image and poll steps are explicitly out of scope for this iteration.
- The recipient for a run is always picked fresh at run time — never stored
  on the automation itself (an automation is reusable across whichever
  group it's pointed at, though the admin's actual routine always targets
  the same one).
- Because a "group settings" step only makes sense against a WhatsApp
  group, an automation run's recipient is restricted to WhatsApp groups
  only — there's no "מאמנים" option here (unlike the regular compose tab).
- A step's time-of-day can optionally be saved on the step itself (so
  reapplying doesn't require re-entering it every time), but isn't
  required — a step with no saved time just prompts for one at run time.
- Running an automation always requires picking a date; each step's
  `scheduled_at` is that date + the step's time (saved or entered at
  run time), producing ordinary rows in the existing `whatsapp_scheduled`
  table — from that point on, they're indistinguishable from any
  individually-scheduled message and are handled by the completely
  unmodified cron dispatcher.

## Data Model

### New table: `whatsapp_automations`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | e.g. "פתיחה וסגירה יומית" |
| created_at | timestamptz, default now() | |

### New table: `whatsapp_automation_steps`
| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| automation_id | uuid, FK to `whatsapp_automations` | |
| step_order | int | 1-based position in the sequence |
| time_of_day | text, nullable | `"HH:MM"`, or `null` if not saved on the step |
| message_type | text | `"text"` or `"group_settings"` |
| payload | text | same string shape already used by `whatsapp_scheduled.message` — either plain text (for `"text"` steps) or `JSON.stringify({ __type: "group_settings", allowParticipantsSendMessages })` (for `"group_settings"` steps) |

Storing `payload` in the exact same shape `whatsapp_scheduled.message`
already uses is deliberate: running an automation step becomes a direct
copy into a new `whatsapp_scheduled` row with zero translation/parsing
logic needed, and the cron dispatcher needs no changes at all.

RLS enabled on both new tables, following existing conventions (service
role only, no policies — same as every other table in this app).

## UI

### Third tab: "אוטומציות" in `/admin/whatsapp`

Alongside the existing "הודעות מתוזמנות" and "הודעה חדשה" tabs. Shows a
list of saved automations (name + step count), each with edit/delete and a
**"הפעל"** (run) action.

### Creating/editing an automation

A form: name, plus an ordered list of steps (add/remove), each step with:
- An optional time input ("HH:MM").
- A type toggle: טקסט / הגדרות קבוצה — matching the visual style of the
  existing message-type selector in the compose tab.
- Type-specific content: a text `Textarea` for `"text"` steps, or the same
  open/close two-button toggle already used for `group_settings` messages
  in the compose tab, for `"group_settings"` steps.

### Running an automation

Clicking "הפעל" opens a dialog:
1. A WhatsApp-group picker (reusing the existing `/api/whatsapp/groups`
   data — no "מאמנים" option here, per Scope above).
2. A date picker.
3. One time input per step — pre-filled from the step's saved
   `time_of_day` if it has one, editable regardless; steps with no saved
   time start empty and must be filled in before confirming.
4. On confirm, one `whatsapp_scheduled` row is created per step:
   `chat_id`/`chat_name` = the chosen group, `scheduled_at` = chosen date +
   that step's time (Israel local time, matching how every other
   date+time in this app is interpreted), `message` = the step's `payload`
   verbatim, `status` = `"pending"` — i.e., exactly what
   `POST /api/whatsapp/scheduled` already produces for a manually-composed
   message, just created N times in one action instead of one at a time.

## Out of Scope (YAGNI)

- Image and poll step types.
- Storing/remembering a recipient on the automation itself.
- Any recurring/automatic re-triggering — running an automation is always
  a manual, explicit action that creates concrete one-off scheduled rows;
  it does not set up an ongoing recurring rule (that's a separate,
  not-yet-designed future feature).
- Any cross-day step support (e.g. a step meant for "the next day") —
  every step in a single run shares the one date picked for that run.
- Any editing of the automation's own steps from within the "run" dialog —
  only the recipient, date, and (for unsaved-time steps) the time can be
  adjusted per run; changing a step's content/order/type requires editing
  the automation itself.
