# WhatsApp Message Templates — Design Spec

Date: 2026-08-27

## Purpose

The admin repeatedly types similar WhatsApp messages (reminders, updates)
from scratch in the "הודעה חדשה" compose tab (`/admin/whatsapp`). This adds
reusable, named templates with fill-in-the-blank placeholders, managed
inline from the same compose screen — no separate management page.

This is the first of four related WhatsApp-scheduler upgrades being
designed and shipped independently (templates → multi-group sending →
batch advance scheduling → recurring schedules). This spec covers templates
only.

## Scope

- Templates are plain named text blocks with optional `{{placeholder}}`
  markers, usable for any of the three message compose fields that already
  exist: the text message body, an image's caption, and a poll's question.
  A template isn't tied to one specific field type — the same template can
  be loaded into any of them.
- Full CRUD: create, edit, delete. Managed entirely inline within the
  existing compose tab, via a dialog — no new page, no new nav item.
- Placeholder substitution happens client-side, live, as the admin fills in
  generated input fields — it never touches the scheduling/dispatch logic.
  By the time a message is scheduled, it's already a fully resolved plain
  string exactly like today; the cron dispatcher (`/api/cron/whatsapp-send`)
  needs zero changes.

## Data Model

### New table: `whatsapp_templates`

| column | type | notes |
|---|---|---|
| id | uuid, pk | |
| name | text | short label shown in the picker, e.g. "תזכורת אימון" |
| body | text | the template text, with `{{name}}` markers anywhere the admin wants a fill-in-the-blank |
| created_at | timestamptz, default now() | |

RLS enabled, following existing conventions. No relation to any other
table — templates are just reusable text.

## API

Following the existing `/api/whatsapp/scheduled` route's conventions
(admin-only via `requireUser`, typed `NextResponse.json()`):

- `GET /api/whatsapp/templates` — list all, ordered by `name`.
- `POST /api/whatsapp/templates` — create (`{ name, body }`).
- `PATCH /api/whatsapp/templates/[id]` — edit (`{ name, body }`).
- `DELETE /api/whatsapp/templates/[id]` — delete.

## UI

### Managing templates: a dialog, not a page

A new **"תבניות"** button next to the "הודעה" section header in the
compose tab (`src/components/whatsapp-scheduler.tsx`). Opens a `Dialog`
(matching the existing shadcn `Dialog` pattern already used elsewhere in
this app, e.g. `ManageRosterDialog`) showing:
- A list of saved templates: name + a truncated preview of `body`, each row
  with "ערוך" and "מחק" actions.
- A "תבנית חדשה" button that opens a small inline form (two fields: שם,
  טקסט) within the same dialog — used for both creating a new template and
  editing an existing one (same form, pre-filled when editing).
- No placeholder-specific UI when authoring a template — the admin simply
  types `{{שם}}`-style markers directly into the body text like any other
  characters. No insert-a-placeholder button, no validation of marker
  syntax beyond what's needed to detect them later (see below).

### Using a template while composing

Directly above whichever field is relevant to the currently-selected
message type (the text `Textarea`, the image caption `Textarea`, or the
poll question `Input`), a new **"טען תבנית"** `Select` listing all saved
templates by name, plus a "ללא תבנית" default.

On selecting one:
1. Its `body` is detected for placeholders via `/\{\{([^}]+)\}\}/g`,
   collecting each unique name found (in first-occurrence order).
2. One small input field per unique placeholder name is rendered right
   above the target field (label = the placeholder name itself, e.g. a
   template containing `{{תאריך}}` and `{{שעה}}` gets two inputs labeled
   "תאריך" and "שעה").
3. The target field's value is immediately set to the template's `body` as
   raw text (markers still visible) — then updates live on every keystroke
   in a placeholder input, replacing every occurrence of that `{{name}}` in
   the text with the input's current value (empty string clears it back to
   showing nothing for that spot, not the literal marker).
4. The target field stays a normal, directly-editable `Textarea`/`Input`
   throughout — the admin can freely hand-edit the resulting text at any
   point, including after filling placeholders. There's no "locked"
   template state; loading a template is just a one-time text-fill
   convenience, not an ongoing binding.
   **Substitution mechanics:** the displayed text is always recomputed as
   the original template's `body` with every currently-filled placeholder
   substituted in — so typing in a placeholder input re-derives the whole
   field from scratch each time, it doesn't patch in place. This means if
   the admin manually edits the field's text directly and *then* changes a
   placeholder input again, the field is recomputed from the template and
   the manual edit is lost. This is an accepted simplification: hand-editing
   is meant for the *final* pass once all placeholders are filled, not
   interleaved with further placeholder changes.
5. Switching to a different template, or back to "ללא תבנית", clears the
   placeholder inputs and (for "ללא תבנית") leaves the field's current text
   untouched — it's a starting point, not a data source that keeps
   re-syncing.

## Out of Scope (YAGNI)

- No template categories/tagging, no per-message-type restriction on which
  templates apply where.
- No placeholder type-checking or required/optional flagging — every
  detected placeholder is a plain text input, always optional (an unfilled
  one just leaves an empty gap where `{{name}}` was).
- No auto-population of placeholders from app data (student name, session
  date, etc.) — purely manual fill-in, matching how the rest of this
  scheduler is entirely manual today.
- No usage tracking/most-recently-used sorting for the template picker —
  plain alphabetical-by-name list.
- No changes to the cron dispatcher or the `whatsapp_scheduled` table — a
  scheduled message row is indistinguishable from one composed without a
  template at all.
