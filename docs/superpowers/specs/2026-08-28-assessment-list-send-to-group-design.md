# Assessment List — Send to Group — Design Spec

Date: 2026-08-28

## Purpose

The two assessment report list pages (admin and coach) each have a per-row
"send" button that sends the report PDF via WhatsApp directly to the
participant's phone, with no other option. The full report detail page
(`assessment-detail-view.tsx`) already supports a second destination — a
"Master Class" WhatsApp group — via a separate button. This adds the same
group-sending option to the two list pages, without requiring the coach/
admin to open the full report first.

## Scope

- Applies to exactly two files: `src/app/(admin)/admin/assessments/page.tsx`
  and `src/app/(coach)/coach/assessments/page.tsx`.
- `src/components/assessment-detail-view.tsx` is explicitly **not**
  touched — it keeps its existing two-separate-buttons layout ("WhatsApp
  אישי" / "שלח לקבוצת מאסטר קלאס") exactly as it is today.
- `src/app/(admin)/admin/students/[id]/page.tsx` is explicitly **not**
  touched — its assessment rows link into the full detail page, which
  already covers both send destinations; no quick-send button is added
  there per product decision (2026-08-28).
- Group filtering matches the existing detail-view behavior exactly: only
  WhatsApp groups whose name contains "מאסטר קלאס" or (case-insensitively)
  "master class" are offered — not the full group list used by the
  WhatsApp scheduler.

## Current Behavior (for reference)

In both list pages today, each row's send button is:

```tsx
<button
  type="button"
  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
  title="שלח ב-WhatsApp"
  onClick={(e) => { e.preventDefault(); sendWhatsApp(a); }}
>
  <Send size={14} />
</button>
```

`sendWhatsApp(a)` (duplicated identically in both files) fetches a share
token, builds the PDF URL, and `POST`s to `/api/whatsapp/send` with
`a.participant_phone` as the recipient — sending immediately, no menu.

The detail view's existing group-picker (`assessment-detail-view.tsx`)
fetches `/api/whatsapp/groups`, filters client-side by name, caches the
result in local component state, and renders a dropdown of matching groups
with click-outside-to-close behavior.

## New Behavior

Clicking the row's send button no longer sends immediately. Instead it
opens a small popover anchored to the button, with:

1. "שלח למשתתף" row — only shown if `a.participant_phone` is set. Selecting
   it does exactly what today's instant-send did (same API call, same
   toast messages).
2. Below it, the matching "מאסטר קלאס" group(s) — same filter as the
   detail view. Selecting one sends the same PDF to that group instead
   (same `/api/whatsapp/send` call, with the group's chat id in place of a
   phone number — `sendWhatsAppFileByUpload`/`sendWhatsAppMessage` already
   accept any chat id, group or phone, unchanged).
3. While the group list is loading, show a small spinner in place of the
   list. If no matching groups exist, show a short inline "לא נמצאו קבוצות
   מאסטר קלאס" message in the popover (instead of the detail view's
   toast-on-open, since this is now a menu the user opens deliberately,
   not an instant action).
4. Clicking outside the popover, or selecting an option, closes it.

Each row's popover is independent — opening one row's menu does not affect
another row's.

## Architecture

A new shared client component, `src/components/assessment-send-menu.tsx`,
encapsulates the button + popover + fetch + send logic described above, so
it isn't written twice across the two list pages (matching the file
structure principle used throughout this codebase — one component, one
clear responsibility, reused by both call sites).

```ts
export function AssessmentSendMenu({ assessment }: { assessment: Assessment }): JSX.Element
```

- Group list: fetched via TanStack Query (`useQuery(["whatsapp:masterClassGroups"], ...)`
  hitting `/api/whatsapp/groups`, filtered client-side by name), with a
  `staleTime` so opening the menu on multiple rows doesn't re-fetch from
  Green API every time — matches the caching convention already used
  elsewhere in this codebase (e.g. `staleTime: 60_000` on the assessments
  list queries themselves).
- Open/close state: local `useState` inside each `AssessmentSendMenu`
  instance — one popover per row, independent of the others.
- Send logic (both destinations): reuses the exact same share-token →
  build PDF URL → `POST /api/whatsapp/send` sequence already used by both
  list pages and the detail view today. No changes to
  `/api/whatsapp/send`, `/api/whatsapp/groups`, or `/api/assessments/:id/share-token`.
- Both list pages replace their existing inline send button + local
  `sendWhatsApp` function with `<AssessmentSendMenu assessment={a} />`.

## Error Handling

Unchanged from today's behavior, just triggered from the new menu instead
of an instant click:
- Missing participant phone → "שלח למשתתף" row is simply not shown (same
  as today's `{a.participant_phone && (...)}` guard).
- Token/send failure → `toast.error`, same messages as today.
- Successful send → `toast.success` ("נשלח" / "נשלח ב-WhatsApp", matching
  each page's existing wording).
- Group fetch failure → `toast.error("שגיאה בטעינת קבוצות")`, matching the
  detail view's existing wording.

## Out of Scope (YAGNI)

- No change to `assessment-detail-view.tsx` or `admin/students/[id]/page.tsx`.
- No option to send to a non-"מאסטר קלאס" group, or to pick from the full
  WhatsApp group list — stays scoped to the same filtered set the detail
  view already uses.
- No "send to both destinations in one click" — each menu selection is a
  single send, matching today's one-recipient-per-click detail-view
  pattern (just reachable from two more entry points now).
