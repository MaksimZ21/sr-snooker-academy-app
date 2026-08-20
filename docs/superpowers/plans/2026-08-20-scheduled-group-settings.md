# Scheduled WhatsApp Group Settings Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin schedule a WhatsApp group's "who can send messages" setting (open to everyone / admins-only) to change automatically at a future date+time, reusing the existing scheduled-message infrastructure.

**Architecture:** No new table or cron job. The existing `whatsapp_scheduled` table already stores a polymorphic `message` (a JSON blob with a `__type` discriminator dispatched by `/api/cron/whatsapp-send`). This adds a fourth `__type`, `group_settings`, alongside the existing `text`/`image`/`poll` types — one new Green API client function, one new branch in the cron dispatcher, and new compose/display UI in the existing WhatsApp scheduler page.

**Tech Stack:** TypeScript, Next.js 16 API routes, React 19 + TanStack Query, Green API (WhatsApp).

**Spec:** `docs/superpowers/specs/2026-08-20-scheduled-group-settings-design.md`

**Testing note:** This codebase does not unit-test Supabase/external-API-backed modules (`src/lib/whatsapp/`, `src/app/api/`) — only pure-logic files have vitest coverage. `npx tsc --noEmit` is the automated gate for each step; Task 5 covers manual end-to-end verification against the real Green API (required, since nothing here is mockable locally — no Green API credentials exist in this local dev environment).

---

### Task 1: Add `updateGroupSettings` to the Green API client

**Files:**
- Modify: `src/lib/whatsapp/greenapi.ts`

- [ ] **Step 1: Add the function**

Add this at the end of `src/lib/whatsapp/greenapi.ts` (after `getWhatsAppGroups`):

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

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the function is unused so far — expected, it gets wired up in Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp/greenapi.ts
git commit -m "feat(whatsapp): add updateGroupSettings to Green API client"
```

---

### Task 2: Wire the cron dispatcher to handle `group_settings`

**Files:**
- Modify: `src/app/api/cron/whatsapp-send/route.ts`

- [ ] **Step 1: Update the import**

Change:

```ts
import { sendWhatsAppMessage, sendWhatsAppFile, sendWhatsAppPoll } from "@/lib/whatsapp/greenapi";
```

to:

```ts
import { sendWhatsAppMessage, sendWhatsAppFile, sendWhatsAppPoll, updateGroupSettings } from "@/lib/whatsapp/greenapi";
```

- [ ] **Step 2: Extend `ParsedMessage` and `parseMessage`**

Change:

```ts
type ParsedMessage =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption: string }
  | { type: "poll"; question: string; options: string[] };

function parseMessage(raw: string): ParsedMessage {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image" && typeof p.url === "string") {
      return { type: "image", url: p.url, caption: typeof p.caption === "string" ? p.caption : "" };
    }
    if (p.__type === "poll" && typeof p.question === "string" && Array.isArray(p.options)) {
      return { type: "poll", question: p.question, options: p.options as string[] };
    }
  } catch {}
  return { type: "text", text: raw };
}
```

to:

```ts
type ParsedMessage =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption: string }
  | { type: "poll"; question: string; options: string[] }
  | { type: "group_settings"; allowParticipantsSendMessages: boolean };

function parseMessage(raw: string): ParsedMessage {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image" && typeof p.url === "string") {
      return { type: "image", url: p.url, caption: typeof p.caption === "string" ? p.caption : "" };
    }
    if (p.__type === "poll" && typeof p.question === "string" && Array.isArray(p.options)) {
      return { type: "poll", question: p.question, options: p.options as string[] };
    }
    if (p.__type === "group_settings" && typeof p.allowParticipantsSendMessages === "boolean") {
      return { type: "group_settings", allowParticipantsSendMessages: p.allowParticipantsSendMessages };
    }
  } catch {}
  return { type: "text", text: raw };
}
```

- [ ] **Step 3: Extend `dispatch`**

Change:

```ts
async function dispatch(target: string, msg: ParsedMessage): Promise<void> {
  if (msg.type === "text") return sendWhatsAppMessage(target, msg.text);
  if (msg.type === "image") return sendWhatsAppFile(target, msg.url, msg.caption);
  if (msg.type === "poll") return sendWhatsAppPoll(target, msg.question, msg.options);
}
```

to:

```ts
async function dispatch(target: string, msg: ParsedMessage): Promise<void> {
  if (msg.type === "text") return sendWhatsAppMessage(target, msg.text);
  if (msg.type === "image") return sendWhatsAppFile(target, msg.url, msg.caption);
  if (msg.type === "poll") return sendWhatsAppPoll(target, msg.question, msg.options);
  if (msg.type === "group_settings") return updateGroupSettings(target, msg.allowParticipantsSendMessages);
}
```

Note: `dispatchToTarget` (the function that calls `dispatch`) needs no changes — its `coaches:all`/`coach:<email>` special-casing is only reachable for rows whose `chat_id` was set that way from the UI, and the UI (Task 3) only ever creates `group_settings` rows with a real group's `@g.us` chat_id, which falls through to the existing `await dispatch(chatId, parsed);` call at the bottom of `dispatchToTarget` unchanged.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/whatsapp-send/route.ts
git commit -m "feat(whatsapp): dispatch scheduled group_settings changes in the cron"
```

---

### Task 3: Compose UI — new message type, state, and form

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Add the `Lock` icon import**

Change:

```ts
import {
  CheckCircle2,
  Clock,
  Image,
  Loader2,
  MessageSquare,
  BarChart2,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
```

to:

```ts
import {
  CheckCircle2,
  Clock,
  Image,
  Loader2,
  Lock,
  MessageSquare,
  BarChart2,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
```

- [ ] **Step 2: Extend `MessageType`**

Change:

```ts
type MessageType = "text" | "image" | "poll";
```

to:

```ts
type MessageType = "text" | "image" | "poll" | "group_settings";
```

- [ ] **Step 3: Add `groupOpen` state and reset it in `resetCompose`**

Change:

```ts
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [scheduledAt, setScheduledAt] = useState("");

  function resetCompose() {
    setChatId("");
    setChatName("");
    setMsgType("text");
    setText("");
    setImageUrl("");
    setImageCaption("");
    setImageFileName("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setScheduledAt("");
  }
```

to:

```ts
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  function resetCompose() {
    setChatId("");
    setChatName("");
    setMsgType("text");
    setText("");
    setImageUrl("");
    setImageCaption("");
    setImageFileName("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setGroupOpen(null);
    setScheduledAt("");
  }
```

- [ ] **Step 4: Add a message-type-change handler that forces the recipient to "group"**

Change:

```ts
  function handleRecipientModeChange(next: RecipientMode) {
    setRecipientMode(next);
    setChatId("");
    setChatName("");
  }
```

to (adding a new function right after it — `handleRecipientModeChange` itself is unchanged):

```ts
  function handleRecipientModeChange(next: RecipientMode) {
    setRecipientMode(next);
    setChatId("");
    setChatName("");
  }

  function handleMsgTypeChange(next: MessageType) {
    setMsgType(next);
    if (next === "group_settings" && recipientMode !== "group") {
      handleRecipientModeChange("group");
    }
  }
```

- [ ] **Step 5: Update `addMut`'s message-building logic**

Change:

```ts
      let message: string;
      if (msgType === "text") {
        message = text;
      } else if (msgType === "image") {
        message = JSON.stringify({ __type: "image", url: imageUrl, caption: imageCaption });
      } else {
        message = JSON.stringify({
          __type: "poll",
          question: pollQuestion,
          options: pollOptions.filter((o) => o.trim()),
        });
      }
```

to:

```ts
      let message: string;
      if (msgType === "text") {
        message = text;
      } else if (msgType === "image") {
        message = JSON.stringify({ __type: "image", url: imageUrl, caption: imageCaption });
      } else if (msgType === "poll") {
        message = JSON.stringify({
          __type: "poll",
          question: pollQuestion,
          options: pollOptions.filter((o) => o.trim()),
        });
      } else {
        message = JSON.stringify({
          __type: "group_settings",
          allowParticipantsSendMessages: groupOpen,
        });
      }
```

- [ ] **Step 6: Update `canSubmit`**

Change:

```ts
  const canSubmit =
    chatId &&
    scheduledAt &&
    !addMut.isPending &&
    !imageUploading &&
    ((msgType === "text" && text.trim()) ||
      (msgType === "image" && imageUrl.trim()) ||
      (msgType === "poll" && pollQuestion.trim() && validOptions.length >= 2));
```

to:

```ts
  const canSubmit =
    chatId &&
    scheduledAt &&
    !addMut.isPending &&
    !imageUploading &&
    ((msgType === "text" && text.trim()) ||
      (msgType === "image" && imageUrl.trim()) ||
      (msgType === "poll" && pollQuestion.trim() && validOptions.length >= 2) ||
      (msgType === "group_settings" && groupOpen !== null));
```

- [ ] **Step 7: Disable the "מאמנים" recipient button while `group_settings` is selected**

Change:

```ts
                <Button
                  size="sm"
                  variant={recipientMode === "coaches" ? "default" : "outline"}
                  className="flex-1"
                  type="button"
                  onClick={() => handleRecipientModeChange("coaches")}
                >
                  מאמנים
                </Button>
```

to:

```ts
                <Button
                  size="sm"
                  variant={recipientMode === "coaches" ? "default" : "outline"}
                  className="flex-1"
                  type="button"
                  disabled={msgType === "group_settings"}
                  onClick={() => handleRecipientModeChange("coaches")}
                >
                  מאמנים
                </Button>
```

- [ ] **Step 8: Add the fourth type-selector button and wire it to the new handler**

Change:

```ts
              {/* Type selector */}
              <div className="flex gap-2">
                {([
                  { value: "text" as const, label: "טקסט", Icon: MessageSquare },
                  { value: "image" as const, label: "תמונה", Icon: Image },
                  { value: "poll" as const, label: "סקר", Icon: BarChart2 },
                ]).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMsgType(value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all duration-150",
                      msgType === value
                        ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
```

to:

```ts
              {/* Type selector */}
              <div className="flex gap-2">
                {([
                  { value: "text" as const, label: "טקסט", Icon: MessageSquare },
                  { value: "image" as const, label: "תמונה", Icon: Image },
                  { value: "poll" as const, label: "סקר", Icon: BarChart2 },
                  { value: "group_settings" as const, label: "הגדרות קבוצה", Icon: Lock },
                ]).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleMsgTypeChange(value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all duration-150",
                      msgType === value
                        ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
```

- [ ] **Step 9: Add the group-settings compose block**

Insert this new block immediately after the closing `)}` of the `{msgType === "poll" && ( ... )}` block (i.e., right before the closing `</section>` of the "Message" section):

```ts
              {/* Group settings */}
              {msgType === "group_settings" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground block">מצב הקבוצה</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={groupOpen === true ? "default" : "outline"}
                      className="flex-1"
                      type="button"
                      onClick={() => setGroupOpen(true)}
                    >
                      פתח קבוצה (כולם יכולים לשלוח)
                    </Button>
                    <Button
                      size="sm"
                      variant={groupOpen === false ? "default" : "outline"}
                      className="flex-1"
                      type="button"
                      onClick={() => setGroupOpen(false)}
                    >
                      סגור קבוצה (רק אדמינים)
                    </Button>
                  </div>
                </div>
              )}
```

To find the exact insertion point: this goes directly after the `</div>` that closes the poll block's `<div className="flex flex-col gap-3">` wrapper and its own closing `)}`, and before the `</section>` that closes the whole "Message" section (the `<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">הודעה</p>` section).

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): add group settings compose UI"
```

---

### Task 4: Display UI — show `group_settings` rows in the scheduled/history list

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Extend `ParsedMsg` and `parseDisplay`**

Change:

```ts
type ParsedMsg =
  | { type: "text"; preview: string }
  | { type: "image"; preview: string }
  | { type: "poll"; preview: string };

function parseDisplay(raw: string): ParsedMsg {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image") return { type: "image", preview: typeof p.caption === "string" && p.caption ? p.caption : "(תמונה)" };
    if (p.__type === "poll") return { type: "poll", preview: typeof p.question === "string" ? p.question : "(סקר)" };
  } catch {}
  return { type: "text", preview: raw };
}
```

to:

```ts
type ParsedMsg =
  | { type: "text"; preview: string }
  | { type: "image"; preview: string }
  | { type: "poll"; preview: string }
  | { type: "group_settings"; preview: string };

function parseDisplay(raw: string): ParsedMsg {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image") return { type: "image", preview: typeof p.caption === "string" && p.caption ? p.caption : "(תמונה)" };
    if (p.__type === "poll") return { type: "poll", preview: typeof p.question === "string" ? p.question : "(סקר)" };
    if (p.__type === "group_settings") {
      return {
        type: "group_settings",
        preview: p.allowParticipantsSendMessages ? "פתיחת קבוצה" : "סגירת קבוצה",
      };
    }
  } catch {}
  return { type: "text", preview: raw };
}
```

- [ ] **Step 2: Update `MessageCard`'s icon and label logic**

Change:

```ts
  const parsed = parseDisplay(m.message);
  const TypeIcon =
    parsed.type === "image" ? Image : parsed.type === "poll" ? BarChart2 : MessageSquare;
```

to:

```ts
  const parsed = parseDisplay(m.message);
  const TypeIcon =
    parsed.type === "image" ? Image :
    parsed.type === "poll" ? BarChart2 :
    parsed.type === "group_settings" ? Lock :
    MessageSquare;
```

Change:

```ts
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <TypeIcon size={10} />
            {parsed.type === "image" ? "תמונה" : parsed.type === "poll" ? "סקר" : "טקסט"}
          </span>
```

to:

```ts
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <TypeIcon size={10} />
            {parsed.type === "image" ? "תמונה" : parsed.type === "poll" ? "סקר" : parsed.type === "group_settings" ? "הגדרות קבוצה" : "טקסט"}
          </span>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): show group settings changes in the scheduled/history list"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all tests pass (24/24 as of the last known-good baseline — this feature touches no tested files, so this count shouldn't change).

- [ ] **Step 3: Manual end-to-end verification (requires a live, authorized Green API instance)**

This cannot be tested locally or by an agent — it requires real WhatsApp group state and the deployed app. Once deployed:

1. Go to `/admin/whatsapp` → "הודעה חדשה" tab.
2. Click the new "הגדרות קבוצה" type button — confirm the "מאמנים" recipient button becomes disabled/grayed and recipient mode is forced to "קבוצת WhatsApp".
3. Pick a real WhatsApp group (ideally a low-stakes test group, not a live student/parent group, for this first test).
4. Choose "סגור קבוצה (רק אדמינים)" (or "פתח קבוצה" — whichever is the *opposite* of the group's current state, so the change is visible).
5. Schedule it for ~2 minutes in the future. Submit.
6. Confirm it appears under "הודעות מתוזמנות" with the label "הגדרות קבוצה" and preview text "סגירת קבוצה" (or "פתיחת קבוצה"), with a lock icon.
7. Wait for the scheduled time to pass (the cron runs on whatever interval is configured on cron-job.org — check `/admin/whatsapp`'s history tab afterward, or manually trigger `POST /api/cron/whatsapp-send` with the `CRON_SECRET` bearer token if you don't want to wait).
8. Confirm the row moved to "היסטוריה" with status "נשלח", and check the actual WhatsApp group's settings (in the WhatsApp app) to confirm the send-permission actually changed.
9. If it shows "נכשל" instead, check the Vercel function logs for `/api/cron/whatsapp-send` for the thrown error message (it will include the Green API HTTP status and response body, per `updateGroupSettings`'s error message).

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check in Step 3 before considering the task done.

---

## Plan Self-Review Notes

- **Spec coverage:** `updateGroupSettings` client function (Task 1), cron dispatch (Task 2), compose UI incl. forcing recipient to "group" and disabling the coaches option (Task 3), display/history list rendering (Task 4), and the spec's explicit out-of-scope items (no `allowParticipantsEditGroupSettings` UI, no current-state preview, no recurring schedules) are all respected — none of them were added anywhere in this plan.
- **No placeholders:** every step has complete, exact code and exact before/after snippets.
- **Type consistency:** `group_settings` is used as the literal `__type` string consistently across the UI's JSON payload (Task 3 Step 5), the cron's `parseMessage`/`dispatch` (Task 2), and the UI's `parseDisplay` (Task 4) — same field name `allowParticipantsSendMessages` (boolean) end-to-end from `updateGroupSettings`'s parameter (Task 1) through to the compose form's `groupOpen` state (Task 3).
