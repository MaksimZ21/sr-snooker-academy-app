# Scheduled WhatsApp Group Settings Change — Design Spec

Date: 2026-08-20

## Problem

The admin can schedule WhatsApp text/image/poll messages via `/admin/whatsapp`,
but there's no way to schedule a *group settings* change — e.g. "open this
group to everyone at 18:00" (it's currently locked to admins-only). Today
this has to be done manually, at the exact moment, via the Green API console.

## Scope

Only the "who can send messages" group setting (WhatsApp's admins-only vs.
everyone toggle) — Green API's `allowParticipantsSendMessages` parameter on
its `UpdateGroupSettings` method. The related "who can edit group info"
setting is explicitly out of scope for this iteration.

## Approach

No new table, no new cron job. This reuses the existing `whatsapp_scheduled`
table and `/api/cron/whatsapp-send` cron exactly as-is — that table already
stores a polymorphic `message` (JSON with a `__type` discriminator: `image`,
`poll`, or plain text) dispatched by the same cron poll loop. This adds a
fourth `__type`: `group_settings`.

## Implementation

### `src/lib/whatsapp/greenapi.ts`

New function, following the existing style of `sendWhatsAppMessage` /
`sendWhatsAppPoll` in this file:

```ts
export async function updateGroupSettings(
  groupId: string,
  allowParticipantsSendMessages: boolean,
): Promise<void> {
  const res = await fetch(`${BASE()}/updateGroupSettings/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, allowParticipantsSendMessages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API updateGroupSettings ${res.status}: ${text}`);
  }
}
```

### `src/app/api/cron/whatsapp-send/route.ts`

- `parseMessage` gains a branch: `p.__type === "group_settings"` with a
  boolean `p.allowParticipantsSendMessages` → returns
  `{ type: "group_settings", allowParticipantsSendMessages: boolean }`.
- `dispatch` gains a branch: for `type === "group_settings"`, calls
  `updateGroupSettings(target, msg.allowParticipantsSendMessages)` instead of
  a send-message call.
- `dispatchToTarget`'s existing `coaches:all` / `coach:<email>` special
  targets are meaningless for this action (a group setting can't target a
  coach) — the UI (below) prevents that combination from ever being composed,
  so no extra guard is added here beyond what already exists structurally
  (a `group_settings` message will always carry a `@g.us` `chat_id`).
- Row status handling (`pending` → `sent`/`failed`, error logging) is
  unchanged — identical to the existing text/image/poll paths.

### `src/components/whatsapp-scheduler.tsx`

- `MessageType` gains `"group_settings"`.
- Type-selector row gets a fourth button: **"הגדרות קבוצה"** (lock icon).
- Selecting it forces `recipientMode` to `"group"` (calls the existing
  `handleRecipientModeChange("group")`), and the "מאמנים" recipient button is
  disabled while this message type is selected — a group setting change only
  makes sense against a WhatsApp group.
- New compose UI for this type: two-option choice, **"פתח קבוצה (כולם
  יכולים לשלוח)"** / **"סגור קבוצה (רק אדמינים)"**, backing a boolean
  `groupOpen` state (default: unset, must be explicitly chosen — included in
  `canSubmit`'s validity check like the other type-specific fields).
- On submit, the JSON payload sent as `message` is
  `JSON.stringify({ __type: "group_settings", allowParticipantsSendMessages: groupOpen })`.
- `parseDisplay` (used by `MessageCard` for both the pending list and
  history) gains a branch: `p.__type === "group_settings"` → 
  `{ type: "group_settings", preview: allowParticipantsSendMessages ? "פתיחת קבוצה" : "סגירת קבוצה" }`.
- `MessageCard`'s `TypeIcon`/type-label logic extends to show a lock icon and
  the label "הגדרות קבוצה" for this type, alongside the existing
  טקסט/תמונה/סקר labels.
- The "תזמון שליחה" date/time field and the submit button are unchanged and
  shared across all four message types.

## Error Handling

Identical to the existing paths: if `updateGroupSettings` throws (e.g. Green
API error, invalid group id), the cron marks that row `failed` and logs it —
same as a failed text/image/poll send. No special-casing needed.

## Out of Scope (YAGNI)

- No UI/API for the "who can edit group info" setting.
- No confirmation/preview of the group's *current* setting before scheduling
  a change (the admin is trusted to know what state they're toggling from).
- No recurring/repeating schedule (open every Monday, etc.) — one-off only,
  matching how every other scheduled message already works.
