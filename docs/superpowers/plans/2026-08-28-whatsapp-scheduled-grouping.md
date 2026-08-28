# WhatsApp Scheduled Messages Grouping & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each WhatsApp automation run as one collapsible batch card (instead of N separate identical-looking rows) in the scheduled-messages list, with one-click cancel for the whole batch, and paginate the ever-growing history section with a "טען עוד" button.

**Architecture:** Two new nullable columns (`automation_run_id`, `automation_name`) on `whatsapp_scheduled`, set once per "הפעל" click and carried on every step's row. The scheduled-messages GET endpoint splits its response into `pending` (unbounded, as today) and a paginated `history` page. All grouping is a pure client-side rendering step — a small helper partitions an already-fetched, already-ordered list into singles and batches by `automation_run_id`, applied independently to `pending` and to the accumulated `history` pages.

**Tech Stack:** TypeScript, Next.js 16, Supabase, Zod, TanStack Query (`useInfiniteQuery`), React 19, Tailwind CSS v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-28-whatsapp-scheduled-grouping-design.md`

**Testing note:** This codebase does not unit-test `src/lib/sheets/`, API routes, or `src/components/`. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual verification in the real UI. The migration is applied manually by the user via the Supabase SQL Editor (no migration runner in this project) — flagged explicitly in Task 1.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260828_whatsapp_scheduled_automation_batch.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE whatsapp_scheduled
  ADD COLUMN automation_run_id UUID,
  ADD COLUMN automation_name TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260828_whatsapp_scheduled_automation_batch.sql
git commit -m "feat(whatsapp): add automation batch columns to whatsapp_scheduled"
```

- [ ] **Step 3: Note for the user**

This migration is **not** applied automatically — flag clearly in your final
report that the user must run this file's SQL manually in the Supabase SQL
Editor before Task 5/7's features will work end-to-end (the app will still
compile and run without it, but new automation runs will fail to insert
until the columns exist, and grouping will simply show no batches since
the columns won't exist for the API to select).

---

### Task 2: `POST /api/whatsapp/scheduled` — accept automation batch fields

**Files:**
- Modify: `src/app/api/whatsapp/scheduled/route.ts`

- [ ] **Step 1: Extend the `ScheduledMessage` type**

Change:
```ts
export type ScheduledMessage = {
  id: string;
  chat_id: string;
  chat_name: string;
  message: string;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  created_at: string;
};
```
to:
```ts
export type ScheduledMessage = {
  id: string;
  chat_id: string;
  chat_name: string;
  message: string;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  created_at: string;
  automation_run_id: string | null;
  automation_name: string | null;
};
```

- [ ] **Step 2: Accept the two new optional fields in the POST body schema**

Change:
```ts
    const body = z
      .object({
        chat_id: z.string().min(1),
        chat_name: z.string().default(""),
        message: z.string().min(1),
        scheduled_at: z.string().min(1),
      })
      .parse(await req.json());
```
to:
```ts
    const body = z
      .object({
        chat_id: z.string().min(1),
        chat_name: z.string().default(""),
        message: z.string().min(1),
        scheduled_at: z.string().min(1),
        automation_run_id: z.string().uuid().optional(),
        automation_name: z.string().optional(),
      })
      .parse(await req.json());
```

Leave the rest of the `POST` handler (the `db.from("whatsapp_scheduled").insert(body)...` call and everything after it) unchanged — `body` already includes the two new optional fields when present, and Supabase's insert omits `undefined` keys, so a request without them (the existing compose-message flow) still inserts `NULL` for both columns exactly as it does today with no columns at all.

Note: this task only touches `POST`. Task 3 handles `GET` in the same file
— do not touch the `GET` function in this task, it's a separate task with
its own review.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors will appear in files that construct a `ScheduledMessage`-
shaped object without the two new fields, or that still destructure the
old `{ messages }` GET response shape — this is expected until Tasks 3, 5,
6, 7 land. Confirm errors are limited to `src/components/whatsapp-scheduler.tsx`
and (if it references the type) `src/components/whatsapp-automation-run-dialog.tsx`,
not something unrelated.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/scheduled/route.ts
git commit -m "feat(whatsapp): accept automation batch id/name on scheduled message create"
```

---

### Task 3: `GET /api/whatsapp/scheduled` — split pending/history, paginate history

**Files:**
- Modify: `src/app/api/whatsapp/scheduled/route.ts`

- [ ] **Step 1: Replace the `GET` handler**

Change:
```ts
export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { data } = await db
      .from("whatsapp_scheduled")
      .select("*")
      .order("scheduled_at", { ascending: true });
    return NextResponse.json({ messages: (data ?? []) as ScheduledMessage[] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```
to:
```ts
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const url = new URL(req.url);
    const historyOffset = Number(url.searchParams.get("historyOffset") ?? "0") || 0;
    const historyLimit = Number(url.searchParams.get("historyLimit") ?? "20") || 20;

    const { data: pendingData } = await db
      .from("whatsapp_scheduled")
      .select("*")
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });

    const { data: historyData, count } = await db
      .from("whatsapp_scheduled")
      .select("*", { count: "exact" })
      .neq("status", "pending")
      .order("scheduled_at", { ascending: false })
      .range(historyOffset, historyOffset + historyLimit - 1);

    const historyHasMore = (count ?? 0) > historyOffset + historyLimit;

    return NextResponse.json({
      pending: (pendingData ?? []) as ScheduledMessage[],
      history: (historyData ?? []) as ScheduledMessage[],
      historyHasMore,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

This is a breaking response-shape change (`{ messages: [...] }` →
`{ pending: [...], history: [...], historyHasMore: boolean }`) — Task 7
updates the only client of this endpoint (`whatsapp-scheduler.tsx`) to
match. `history` is ordered **descending** by `scheduled_at` (most recent
first) since it's paginated from the newest backwards; `pending` keeps its
existing ascending order (soonest-first) since it's still shown in full,
unbounded, exactly as today.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `whatsapp-scheduler.tsx` will now additionally error on its old
`{ messages }` destructuring — expected until Task 7. No errors should
appear in this route file itself.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/scheduled/route.ts
git commit -m "feat(whatsapp): split scheduled messages into paginated pending/history"
```

---

### Task 4: New batch-delete endpoint

**Files:**
- Create: `src/app/api/whatsapp/scheduled/batch/[runId]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { runId } = await params;
    const { error } = await db
      .from("whatsapp_scheduled")
      .delete()
      .eq("automation_run_id", runId)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

This mirrors the existing single-row `DELETE /api/whatsapp/scheduled/[id]`
route's admin-only + pending-only semantics, scoped to every row sharing
`automation_run_id` instead of a single `id`. Unlike the existing sibling
route (which doesn't check its delete's `error`), this new route does
check it — follow the `error`-checking convention already established
elsewhere in this codebase's newer WhatsApp routes (templates,
automations), not the older unchecked pattern.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this new file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/whatsapp/scheduled/batch/[runId]/route.ts"
git commit -m "feat(whatsapp): add endpoint to cancel a whole automation batch"
```

---

### Task 5: Run dialog — generate and send a batch run id

**Files:**
- Modify: `src/components/whatsapp-automation-run-dialog.tsx`

- [ ] **Step 1: Add a stable per-dialog-session run id**

Change:
```ts
export function RunAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<Record<string, string>>(
    () => Object.fromEntries(automation.steps.map((s) => [s.id, s.time_of_day ?? ""])),
  );
```
to:
```ts
export function RunAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<Record<string, string>>(
    () => Object.fromEntries(automation.steps.map((s) => [s.id, s.time_of_day ?? ""])),
  );
  // Generated once per dialog session (stable across retries after a
  // partial failure, since the dialog only unmounts — regenerating this —
  // when it's fully closed and reopened for a genuinely separate run).
  const [runId] = useState(() => crypto.randomUUID());
```

- [ ] **Step 2: Send it on every step**

Change:
```ts
        const r = await fetch("/api/whatsapp/scheduled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            chat_name: chatName,
            message: step.payload,
            scheduled_at: scheduledAt,
          }),
        });
```
to:
```ts
        const r = await fetch("/api/whatsapp/scheduled", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            chat_name: chatName,
            message: step.payload,
            scheduled_at: scheduledAt,
            automation_run_id: runId,
            automation_name: automation.name,
          }),
        });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in this file (the extra POST fields are additive and
the endpoint already accepts them per Task 2).

- [ ] **Step 4: Commit**

```bash
git add src/components/whatsapp-automation-run-dialog.tsx
git commit -m "feat(whatsapp): tag scheduled messages with their automation run"
```

---

### Task 6: Grouping helper and `AutomationBatchCard` component

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Update imports**

Change:
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
to:
```ts
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Image,
  ListChecks,
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

- [ ] **Step 2: Add the grouping type and helper**

Add this right after the existing `parseDisplay` function (before
`export function WhatsAppScheduler()`):

```ts
type ListItem =
  | { kind: "single"; message: ScheduledMessage }
  | { kind: "batch"; runId: string; automationName: string; chatName: string; messages: ScheduledMessage[] };

function groupByAutomationRun(messages: ScheduledMessage[]): ListItem[] {
  const seen = new Set<string>();
  const items: ListItem[] = [];
  for (const m of messages) {
    if (m.automation_run_id) {
      if (seen.has(m.automation_run_id)) continue;
      seen.add(m.automation_run_id);
      const batch = messages.filter((x) => x.automation_run_id === m.automation_run_id);
      items.push({
        kind: "batch",
        runId: m.automation_run_id,
        automationName: m.automation_name ?? "אוטומציה",
        chatName: m.chat_name,
        messages: batch,
      });
    } else {
      items.push({ kind: "single", message: m });
    }
  }
  return items;
}
```

- [ ] **Step 3: Add the `AutomationBatchCard` component**

Add this right after the `MessageCard` function, at the end of the file:

```tsx
function AutomationBatchCard({
  batch,
  onDeleteBatch,
}: {
  batch: Extract<ListItem, { kind: "batch" }>;
  onDeleteBatch?: (runId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const earliest = [...batch.messages].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-3 min-w-0 text-right"
        >
          <ListChecks size={15} className="text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{batch.automationName} · {batch.chatName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {batch.messages.length} שלבים · {formatLocalDatetime(earliest.scheduled_at)}
            </p>
          </div>
          <ChevronDown
            size={14}
            className={cn("text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")}
          />
        </button>
        {onDeleteBatch && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={() => onDeleteBatch(batch.runId)}
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 px-4 pb-4">
          {batch.messages.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: steps rendered inside an expanded batch never receive `onDelete` —
per the spec, cancelling is batch-level only, and `MessageCard`'s
`onDelete` prop is already optional (its delete button only renders when
provided), so this is a no-op change from `MessageCard`'s point of view.

`onDeleteBatch` is optional so the same component can be reused in the
history section without a delete button at all (Task 7).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: this file will still show errors related to the old `useQuery`/
`{ messages }` usage further up — those are fixed in Task 7, not this one.
Confirm no NEW errors from the code added in this task itself (the new
type, helper, and component should be self-consistent and error-free on
their own).

- [ ] **Step 5: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): add automation batch grouping helper and collapsed card"
```

---

### Task 7: Wire pagination, grouping, and batch delete into `WhatsAppScheduler`

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Switch the import from `useQuery` to also bring in `useInfiniteQuery`**

Change:
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```
to:
```ts
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```

(`useQuery` stays imported — it's still used for `groupData`/`coachData` elsewhere in this same file.)

- [ ] **Step 2: Replace the scheduled-messages query**

Change:
```ts
  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ["whatsapp:scheduled"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/scheduled");
      return (await r.json()) as { messages: ScheduledMessage[] };
    },
  });
```
to:
```ts
  const scheduledQuery = useInfiniteQuery({
    queryKey: ["whatsapp:scheduled"],
    queryFn: async ({ pageParam }) => {
      const r = await fetch(`/api/whatsapp/scheduled?historyOffset=${pageParam}&historyLimit=20`);
      return (await r.json()) as { pending: ScheduledMessage[]; history: ScheduledMessage[]; historyHasMore: boolean };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.historyHasMore ? allPages.length * 20 : undefined),
  });
  const loadingMsgs = scheduledQuery.isLoading;
```

- [ ] **Step 3: Add the batch-delete mutation**

Add this right after the existing `deleteMut` definition:

```ts
  const deleteBatchMut = useMutation({
    mutationFn: async (runId: string) => {
      const r = await fetch(`/api/whatsapp/scheduled/batch/${runId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("האוטומציה בוטלה");
      qc.invalidateQueries({ queryKey: ["whatsapp:scheduled"] });
    },
    onError: () => toast.error("שגיאה בביטול"),
  });
```

- [ ] **Step 4: Replace the derived `messages`/`pending`/`history` variables**

Change:
```ts
  const messages = msgData?.messages ?? [];
  const pending = messages.filter((m) => m.status === "pending");
  const history = messages.filter((m) => m.status !== "pending");
```
to:
```ts
  const pending = scheduledQuery.data?.pages[0]?.pending ?? [];
  const history = scheduledQuery.data?.pages.flatMap((p) => p.history) ?? [];
```

- [ ] **Step 5: Render grouped pending messages**

Change:
```tsx
              {loadingMsgs ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : pending.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  אין הודעות מתוזמנות
                </div>
              ) : (
                pending.map((m) => (
                  <MessageCard key={m.id} m={m} onDelete={() => deleteMut.mutate(m.id)} />
                ))
              )}
```
to:
```tsx
              {loadingMsgs ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : pending.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  אין הודעות מתוזמנות
                </div>
              ) : (
                groupByAutomationRun(pending).map((item) =>
                  item.kind === "batch" ? (
                    <AutomationBatchCard
                      key={item.runId}
                      batch={item}
                      onDeleteBatch={(runId) => deleteBatchMut.mutate(runId)}
                    />
                  ) : (
                    <MessageCard key={item.message.id} m={item.message} onDelete={() => deleteMut.mutate(item.message.id)} />
                  ),
                )
              )}
```

- [ ] **Step 6: Render grouped, paginated history**

Change:
```tsx
            {history.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">היסטוריה</p>
                {history.map((m) => (
                  <MessageCard key={m.id} m={m} />
                ))}
              </div>
            )}
```
to:
```tsx
            {history.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">היסטוריה</p>
                {groupByAutomationRun(history).map((item) =>
                  item.kind === "batch" ? (
                    <AutomationBatchCard key={item.runId} batch={item} />
                  ) : (
                    <MessageCard key={item.message.id} m={item.message} />
                  ),
                )}
                {scheduledQuery.hasNextPage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-center mt-1"
                    onClick={() => scheduledQuery.fetchNextPage()}
                    disabled={scheduledQuery.isFetchingNextPage}
                  >
                    {scheduledQuery.isFetchingNextPage ? "טוען..." : "טען עוד"}
                  </Button>
                )}
              </div>
            )}
```

Note: history batch cards are rendered without an `onDeleteBatch` prop —
`AutomationBatchCard`'s delete button only renders when that prop is
passed (Task 6), so this correctly keeps history read-only, per spec.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project — this was the last file with
pending errors from the API shape change in Task 3.

- [ ] **Step 8: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): group automation runs and paginate scheduled message history"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature touches no tested
files).

- [ ] **Step 3: Remind the user about the manual migration**

Before any manual QA can show real results, the user must run Task 1's
migration SQL in the Supabase SQL Editor (`ALTER TABLE whatsapp_scheduled
ADD COLUMN automation_run_id UUID, ADD COLUMN automation_name TEXT;`) —
state this explicitly and wait for confirmation it's been applied before
asking them to test the batch-grouping behavior specifically (pagination
and single-message behavior will still work without it, since those
columns are simply `NULL`/absent for existing rows either way).

- [ ] **Step 4: Manual end-to-end verification**

Once the migration is applied and the app is deployed:

1. Run an automation (via "הפעל" on an existing automation, or create one
   first) with several steps. Confirm the resulting rows appear in
   "ממתינות לשליחה" as **one collapsed card** (automation name + group name
   + step count + earliest date), not N separate cards.
2. Click the card to expand it — confirm each step shows as its own row
   (same look as a regular scheduled message), with no per-step delete
   button.
3. Click the batch's trash icon — confirm it prompts nothing (immediate,
   matching today's single-delete behavior) and removes the whole batch
   from the pending list; refresh and confirm they're gone for good.
4. Schedule a one-off message from "הודעה חדשה" (not via an automation) —
   confirm it still renders as a normal, ungrouped single card, unaffected.
5. If there are more than 20 history items (sent/failed messages),
   confirm only the most recent 20 show initially, a "טען עוד" button
   appears below them, and clicking it appends the next 20 without losing
   or re-collapsing what's already shown. If there are 20 or fewer, confirm
   no "טען עוד" button appears at all.
6. Confirm an automation run whose steps have partly executed (some sent,
   some still pending) shows as two separate collapsed cards — one in
   "ממתינות לשליחה" for the remaining steps, one in "היסטוריה" for the
   already-sent ones — each with the correct step count for its own
   section, and the history one has no delete button.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail for each check in Step 4 before considering the task
done, and explicitly confirm whether the migration reminder from Step 3
was acknowledged.

---

## Plan Self-Review Notes

- **Spec coverage:** every section of the spec (`Data Model`, `API
  Changes`, `UI Changes: Grouping / Collapsed batch card / History
  pagination`) maps to a task — Task 1 (schema), Tasks 2–4 (API), Task 5
  (run dialog tagging), Tasks 6–7 (UI grouping + pagination + batch
  delete). `Out of Scope` items (no pending pagination, no server-side
  grouping, no cross-section merging, no delete confirmation) are all
  correctly absent from every task.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `ListItem`'s `"batch"` variant fields
  (`runId`, `automationName`, `chatName`, `messages`) are defined once in
  Task 6 and consumed identically (same field names) in `AutomationBatchCard`
  (Task 6) and both render call sites (Task 7). `ScheduledMessage`'s two
  new fields (Task 2) are read the same way (`m.automation_run_id`,
  `m.automation_name`) everywhere they're used (Task 5's write side, Task
  6's grouping helper).
- **Sequencing:** Tasks are ordered so each typecheck step's "expected
  errors elsewhere" note stays accurate — Task 2 changes the type and
  `POST` (introducing errors in files not yet updated), Task 3 changes
  `GET`'s response shape (introducing more), Tasks 5–7 resolve them one
  file at a time, ending with a fully clean Task 7 typecheck.
