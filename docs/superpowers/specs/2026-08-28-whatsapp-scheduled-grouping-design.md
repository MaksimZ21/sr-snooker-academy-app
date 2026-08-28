# WhatsApp Scheduled Messages — Automation Grouping & History Pagination — Design Spec

Date: 2026-08-28

## Purpose

Running a WhatsApp automation (via "הפעל") schedules one row per step (e.g.
5 rows for a 5-step automation) into the same flat "הודעות מתוזמנות" list
used for one-off compose messages. Two problems:

1. An automation run shows up as N separate, indistinguishable cards —
   there's no visual indication they're one automation, and no easy way to
   cancel the whole run at once.
2. The list (pending + history combined) has no limit and will keep
   growing forever as more messages accumulate over months/years.

## Scope

- Applies to `src/components/whatsapp-scheduler.tsx`, the
  `/api/whatsapp/scheduled` routes, `whatsapp_scheduled` table, and
  `src/components/whatsapp-automation-run-dialog.tsx`.
- Both the "ממתינות לשליחה" (pending) and "היסטוריה" (history) sections get
  automation-batch grouping, applied independently within each section
  (a batch that's partially sent shows a collapsed card in pending for its
  remaining steps and a separate collapsed card in history for its already-
  sent steps — no cross-section merging).
- Only history gets pagination ("טען עוד") — pending stays fully shown,
  unbounded, since it only ever contains what's genuinely still queued and
  is naturally small and actionable.
- One-off compose messages (not from an automation) are entirely
  unaffected — they keep rendering exactly as they do today.

## Data Model

`whatsapp_scheduled` gets two new nullable columns:

```sql
ALTER TABLE whatsapp_scheduled
  ADD COLUMN automation_run_id UUID,
  ADD COLUMN automation_name TEXT;
```

- `automation_run_id`: a fresh UUID generated once per "הפעל" click (client-
  side, `crypto.randomUUID()`), shared by every step scheduled in that run.
  `NULL` for one-off compose messages.
- `automation_name`: the automation's name at the time it was run, denormalized
  the same way `chat_name` already is — so the grouped card doesn't need a
  join, and still reads correctly even if the automation is later renamed
  or deleted.

No backfill needed — existing rows simply have `NULL` in both columns and
render as ungrouped singles, same as today.

## API Changes

### `POST /api/whatsapp/scheduled`

Accepts two new optional fields:

```ts
automation_run_id: z.string().uuid().optional(),
automation_name: z.string().optional(),
```

Passed straight through to the insert. Omitted entirely by the existing
compose-message flow (unaffected).

### `src/components/whatsapp-automation-run-dialog.tsx`

`runMut`'s `mutationFn` generates one `const runId = crypto.randomUUID();`
before the step loop (not per-step), and includes
`automation_run_id: runId, automation_name: automation.name` in every
step's POST body.

### `GET /api/whatsapp/scheduled`

Changes shape and adds pagination for history:

- Query params: `historyOffset` (default `0`), `historyLimit` (default `20`).
- Response: `{ pending: ScheduledMessage[], history: ScheduledMessage[], historyHasMore: boolean }`.
- `pending`: all rows with `status = 'pending'`, ascending by `scheduled_at`
  (same query as today, just now returned under its own key instead of
  mixed into one flat `messages` array).
- `history`: rows with `status != 'pending'`, **descending** by
  `scheduled_at` (most recent first), sliced to
  `[historyOffset, historyOffset + historyLimit)`.
- `historyHasMore`: `true` if more history rows exist past this page
  (computed from a `count: "exact"` on the history query).

`ScheduledMessage` type gains `automation_run_id: string | null` and
`automation_name: string | null`.

### New: `DELETE /api/whatsapp/scheduled/batch/[runId]`

Deletes every row where `automation_run_id = runId AND status = 'pending'`
— cancels every not-yet-sent step of that run in one action. Already-sent
steps of the same run (if any) are untouched, matching the existing
single-row delete's pending-only semantics.

## UI Changes

### Grouping (client-side)

A small pure helper partitions an already-fetched, already-ordered
`ScheduledMessage[]` into a render list of either individual messages or
automation batches, preserving each item's original chronological
position (a batch renders at the position of the first step it contains):

```ts
type ListItem =
  | { kind: "single"; message: ScheduledMessage }
  | { kind: "batch"; runId: string; automationName: string; chatName: string; messages: ScheduledMessage[] };
```

Applied separately to `pending` and to the accumulated `history` pages —
never mixed across the two sections.

### Collapsed batch card

New component, e.g. `AutomationBatchCard`. Collapsed by default:

- Header row: automation name + group name + step count + the date of the
  batch's earliest step (e.g. "קהילת הסנוקר והפול בישראל · 5 שלבים ·
  03.09.2026"), a chevron to expand/collapse, and — **only in the pending
  section** — a trash icon that deletes the whole batch via the new
  `DELETE .../batch/[runId]` endpoint (with a confirmation toast/undo is
  out of scope — matches today's single-row delete, which is also
  immediate with no confirmation step).
- Expanded: each step renders using the existing `MessageCard` component,
  exactly as an ungrouped message does today, but without its own
  individual delete button (deletion is batch-level only inside an
  expanded card).

Ungrouped (`kind: "single"`) messages keep rendering exactly as today —
this is a pure additive change, no regression to the existing single-
message card.

### History pagination

`whatsapp-scheduler.tsx` switches its scheduled-messages fetch from
`useQuery` to `useInfiniteQuery` (TanStack Query), keyed by `historyOffset`
as the page param:

- Page 1 loads on mount (`historyOffset = 0`), giving both `pending` (used
  as-is, ignored on later pages since it doesn't change) and the first 20
  history rows.
- A "טען עוד" button appears under the history list whenever
  `historyHasMore` is true on the last loaded page; clicking it calls
  `fetchNextPage()`, appending 20 more history rows (existing rows stay
  rendered, nothing collapses or resets).
- `pending` is always taken from the first loaded page.

## Out of Scope (YAGNI)

- No pagination for the pending section — it stays fully shown.
- No server-side grouping — the API keeps returning flat rows; grouping is
  a pure client-side rendering concern.
- No cross-section batch merging (a run split across pending/history shows
  as two separate collapsed cards, not one).
- No confirmation dialog for batch delete — matches the existing single-
  row delete's immediate, no-confirmation behavior.
- No changes to how automations are created/edited/run — only to how the
  resulting scheduled rows are displayed and (for pending batches) bulk-
  cancelled.
