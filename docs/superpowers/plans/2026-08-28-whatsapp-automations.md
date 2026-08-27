# WhatsApp Automations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin save a reusable, named sequence of timed WhatsApp steps (text message or group open/close) and run the whole sequence in one action — picking a WhatsApp group and a date, then creating all the underlying scheduled rows at once.

**Architecture:** Two new tables (`whatsapp_automations`, `whatsapp_automation_steps`, the latter FK-cascading to the former) and a matching CRUD API, mirroring the `whatsapp_templates`/`whatsapp_scheduled` conventions exactly. A step's `payload` is stored in the exact same string shape `whatsapp_scheduled.message` already uses, so "running" an automation needs no new scheduling machinery at all — the run dialog just calls the existing `POST /api/whatsapp/scheduled` once per step, client-side, computing each `scheduled_at` the same way the existing compose form already does (browser-local time → `toISOString()`). Three new focused component files (form, run dialog, list panel) get composed into a new third tab in the existing (already large) `whatsapp-scheduler.tsx`, rather than growing that file's own logic.

**Tech Stack:** TypeScript, Next.js 16 API routes, Supabase, React 19 + TanStack Query, shadcn/ui (`Dialog`, `Select`, `Tabs`).

**Spec:** `docs/superpowers/specs/2026-08-27-whatsapp-automations-design.md`

**Testing note:** This codebase does not unit-test Supabase-backed API routes or `src/components/` — only pure-logic files have vitest coverage. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual end-to-end verification in the real admin UI.

---

### Task 1: `whatsapp_automations`/`whatsapp_automation_steps` migration

**Files:**
- Create: `supabase/migrations/20260828_whatsapp_automations.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE whatsapp_automations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_automation_steps (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id  UUID        NOT NULL REFERENCES whatsapp_automations(id) ON DELETE CASCADE,
  step_order     INT         NOT NULL,
  time_of_day    TEXT,
  message_type   TEXT        NOT NULL,
  payload        TEXT        NOT NULL
);

ALTER TABLE whatsapp_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_steps ENABLE ROW LEVEL SECURITY;
```

`whatsapp_automation_steps.automation_id` cascades on delete, so deleting an
automation automatically removes its steps — no application code needs to
delete steps explicitly when deleting an automation.

- [ ] **Step 2 (SKIP — no DB access in this environment)**

This project has no migration runner; migrations are applied manually via
the Supabase SQL Editor by a human. Do NOT attempt to apply this migration
yourself — just write the file and commit it. Note in your report that it
still needs to be applied manually.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260828_whatsapp_automations.sql
git commit -m "feat(whatsapp): add whatsapp_automations tables migration"
```

---

### Task 2: Automations list/create API

**Files:**
- Create: `src/app/api/whatsapp/automations/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type AutomationStep = {
  id: string;
  automation_id: string;
  step_order: number;
  time_of_day: string | null;
  message_type: "text" | "group_settings";
  payload: string;
};

export type Automation = {
  id: string;
  name: string;
  created_at: string;
  steps: AutomationStep[];
};

const StepInput = z.object({
  time_of_day: z.string().nullable(),
  message_type: z.enum(["text", "group_settings"]),
  payload: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [{ data: automations }, { data: steps }] = await Promise.all([
      db.from("whatsapp_automations").select("*").order("name", { ascending: true }),
      db.from("whatsapp_automation_steps").select("*").order("step_order", { ascending: true }),
    ]);
    const stepsByAutomation = new Map<string, AutomationStep[]>();
    for (const step of (steps ?? []) as AutomationStep[]) {
      const list = stepsByAutomation.get(step.automation_id) ?? [];
      list.push(step);
      stepsByAutomation.set(step.automation_id, list);
    }
    const result = ((automations ?? []) as Omit<Automation, "steps">[]).map((a) => ({
      ...a,
      steps: stepsByAutomation.get(a.id) ?? [],
    }));
    return NextResponse.json({ automations: result });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = z
      .object({
        name: z.string().min(1),
        steps: z.array(StepInput).min(1),
      })
      .parse(await req.json());
    const { data: automation } = await db
      .from("whatsapp_automations")
      .insert({ name: body.name })
      .select()
      .single();
    const rows = body.steps.map((s, i) => ({
      automation_id: (automation as { id: string }).id,
      step_order: i + 1,
      time_of_day: s.time_of_day,
      message_type: s.message_type,
      payload: s.payload,
    }));
    await db.from("whatsapp_automation_steps").insert(rows);
    return NextResponse.json({ ok: true, id: (automation as { id: string }).id });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

Notes for the implementer:
- `GET` deliberately uses two separate flat `.select("*")` queries (one for
  automations, one for all steps) and groups steps by `automation_id` in
  plain JavaScript, rather than a Supabase/PostgREST embedded-relation
  `.select("*, whatsapp_automation_steps(*)")` join. This matches how every
  other multi-table read in this codebase already works (separate queries +
  JS assembly, e.g. `upsertSessionFromCrm` in `src/lib/sheets/sessions.ts`)
  and avoids relying on embedded-select syntax that can't be tested against
  a live database in this environment.
- `POST` intentionally does NOT explicitly check for an insert error before
  reading `automation.id` — if the first insert silently fails (returns
  `data: null`, matching this app's established "don't check `error`,
  destructure only `data`" convention seen throughout every sibling route),
  `(automation as { id: string }).id` throws a `TypeError`, which the
  surrounding `try/catch` already turns into the same generic 500 response
  every other route falls back to. This is the same failure-handling depth
  as `templates/route.ts`'s `POST`, just naturally covering the "can't
  build step rows without a valid automation id" case for free.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/automations/route.ts
git commit -m "feat(whatsapp): add automations list/create API route"
```

---

### Task 3: Automation edit/delete API

**Files:**
- Create: `src/app/api/whatsapp/automations/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

const StepInput = z.object({
  time_of_day: z.string().nullable(),
  message_type: z.enum(["text", "group_settings"]),
  payload: z.string().min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const body = z
      .object({
        name: z.string().min(1),
        steps: z.array(StepInput).min(1),
      })
      .parse(await req.json());
    await db.from("whatsapp_automations").update({ name: body.name }).eq("id", id);
    await db.from("whatsapp_automation_steps").delete().eq("automation_id", id);
    const rows = body.steps.map((s, i) => ({
      automation_id: id,
      step_order: i + 1,
      time_of_day: s.time_of_day,
      message_type: s.message_type,
      payload: s.payload,
    }));
    await db.from("whatsapp_automation_steps").insert(rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    await db.from("whatsapp_automations").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

`PATCH` uses full-replace semantics for steps (delete all existing steps for
this automation, then insert the submitted list fresh) — the same
wholesale-overwrite approach `updateGroup` already uses for `student_ids`,
and the templates feature's `PATCH` uses for `name`/`body` together. No
per-step diffing. `DELETE` doesn't need to delete steps explicitly — the
migration's `ON DELETE CASCADE` handles that at the database level.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/whatsapp/automations/[id]/route.ts"
git commit -m "feat(whatsapp): add automation edit/delete API route"
```

---

### Task 4: Automation create/edit form component

**Files:**
- Create: `src/components/whatsapp-automation-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Automation, AutomationStep } from "@/app/api/whatsapp/automations/route";

type StepDraft = {
  key: string;
  time_of_day: string;
  message_type: "text" | "group_settings";
  text: string;
  groupOpen: boolean | null;
};

function newStep(): StepDraft {
  return { key: crypto.randomUUID(), time_of_day: "", message_type: "text", text: "", groupOpen: null };
}

function stepFromApi(s: AutomationStep): StepDraft {
  if (s.message_type === "group_settings") {
    let groupOpen: boolean | null = null;
    try {
      const parsed = JSON.parse(s.payload) as { allowParticipantsSendMessages?: boolean };
      groupOpen = typeof parsed.allowParticipantsSendMessages === "boolean" ? parsed.allowParticipantsSendMessages : null;
    } catch {}
    return { key: s.id, time_of_day: s.time_of_day ?? "", message_type: "group_settings", text: "", groupOpen };
  }
  return { key: s.id, time_of_day: s.time_of_day ?? "", message_type: "text", text: s.payload, groupOpen: null };
}

function stepIsValid(s: StepDraft): boolean {
  if (s.message_type === "text") return s.text.trim().length > 0;
  return s.groupOpen !== null;
}

function stepToPayload(s: StepDraft) {
  return {
    time_of_day: s.time_of_day || null,
    message_type: s.message_type,
    payload:
      s.message_type === "text"
        ? s.text
        : JSON.stringify({ __type: "group_settings", allowParticipantsSendMessages: s.groupOpen }),
  };
}

function AutomationForm({
  automation,
  onDone,
}: {
  automation?: Automation;
  onDone: () => void;
}) {
  const [name, setName] = useState(automation?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    () => (automation ? automation.steps.map(stepFromApi) : [newStep()]),
  );
  const qc = useQueryClient();

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s.key !== key));
  }

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every(stepIsValid);

  const mut = useMutation({
    mutationFn: async () => {
      const body = { name, steps: steps.map(stepToPayload) };
      const r = automation
        ? await fetch(`/api/whatsapp/automations/${automation.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/whatsapp/automations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(automation ? "אוטומציה עודכנה" : "אוטומציה נוצרה");
      qc.invalidateQueries({ queryKey: ["whatsapp:automations"] });
      onDone();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">שם האוטומציה</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="פתיחה וסגירה יומית" dir="auto" />
      </div>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-col gap-2 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">שלב {i + 1}</span>
              {steps.length > 1 && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(step.key)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">שעה (אופציונלי)</Label>
              <input
                type="time"
                value={step.time_of_day}
                onChange={(e) => updateStep(step.key, { time_of_day: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={step.message_type === "text" ? "default" : "outline"}
                className="flex-1"
                onClick={() => updateStep(step.key, { message_type: "text" })}
              >
                טקסט
              </Button>
              <Button
                size="sm"
                variant={step.message_type === "group_settings" ? "default" : "outline"}
                className="flex-1"
                onClick={() => updateStep(step.key, { message_type: "group_settings" })}
              >
                הגדרות קבוצה
              </Button>
            </div>
            {step.message_type === "text" ? (
              <Textarea
                rows={3}
                value={step.text}
                onChange={(e) => updateStep(step.key, { text: e.target.value })}
                placeholder="כתוב את ההודעה..."
                className="resize-y text-sm"
                dir="auto"
              />
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={step.groupOpen === true ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateStep(step.key, { groupOpen: true })}
                >
                  פתח קבוצה
                </Button>
                <Button
                  size="sm"
                  variant={step.groupOpen === false ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateStep(step.key, { groupOpen: false })}
                >
                  סגור קבוצה
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={() => setSteps((prev) => [...prev, newStep()])}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף שלב
      </Button>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mut.isPending}>
          ביטול
        </Button>
        <Button onClick={() => mut.mutate()} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "שומר..." : "שמור"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function CreateAutomationDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="ml-2 h-4 w-4" />
        אוטומציה חדשה
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>אוטומציה חדשה</DialogTitle>
        </DialogHeader>
        <AutomationForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת אוטומציה</DialogTitle>
        </DialogHeader>
        <AutomationForm automation={automation} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
```

Notes for the implementer:
- `newStep()`'s `key` uses `crypto.randomUUID()` (a browser-native global,
  no import needed) purely as a stable React list key for not-yet-saved
  steps — it's never sent to the server. `stepFromApi()` reuses the step's
  real DB `id` as the key when editing an existing automation, which is
  fine since both are just opaque strings used as React keys.
- `stepFromApi`'s `try { JSON.parse(...) } catch {}` mirrors the same
  defensive-parse pattern already used in `whatsapp-scheduler.tsx`'s
  `parseDisplay` — a malformed/legacy payload just falls back to
  `groupOpen: null` (which `stepIsValid` correctly treats as invalid,
  forcing the admin to re-pick open/closed before saving) rather than
  crashing.
- This single file exports two dialog wrappers (`CreateAutomationDialog`,
  `EditAutomationDialog`) sharing one internal `AutomationForm`, matching
  `src/components/forms/group-dialog.tsx`'s exact convention.
- No drag-and-drop step reordering in this version — steps append at the
  end when added; to reorder, remove and re-add. This matches the design
  spec's scope (no reordering was requested).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Unused until Task 6 wires it into the panel — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-automation-form.tsx
git commit -m "feat(whatsapp): add automation create/edit form component"
```

---

### Task 5: Automation run dialog component

**Files:**
- Create: `src/components/whatsapp-automation-run-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Play } from "lucide-react";
import type { Automation } from "@/app/api/whatsapp/automations/route";

type WhatsAppGroup = { id: string; name: string };

export function RunAutomationDialog({ automation }: { automation: Automation }) {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<Record<string, string>>(
    () => Object.fromEntries(automation.steps.map((s) => [s.id, s.time_of_day ?? ""])),
  );

  const { data: groupData, isLoading: loadingGroups } = useQuery({
    queryKey: ["whatsapp:groups"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/groups");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { groups: WhatsAppGroup[] };
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const chatName = groupData?.groups.find((g) => g.id === chatId)?.name ?? "";
  const canRun = Boolean(chatId) && Boolean(date) && automation.steps.every((s) => (times[s.id] ?? "").trim());

  const runMut = useMutation({
    mutationFn: async () => {
      for (const step of automation.steps) {
        const scheduledAt = new Date(`${date}T${times[step.id]}`).toISOString();
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
        if (!r.ok) throw new Error("failed");
      }
    },
    onSuccess: () => {
      toast.success("האוטומציה תוזמנה");
      setOpen(false);
    },
    onError: () => toast.error("שגיאה בתזמון"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Play className="ml-2 h-4 w-4" />
        הפעל
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הפעלת &quot;{automation.name}&quot;</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">קבוצת WhatsApp</Label>
            {loadingGroups ? (
              <p className="text-sm text-muted-foreground">טוען...</p>
            ) : (
              <Select value={chatId} onValueChange={(v) => setChatId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קבוצה..." />
                </SelectTrigger>
                <SelectContent>
                  {(groupData?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">תאריך</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            {automation.steps.map((step, i) => (
              <div key={step.id}>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  שעת שלב {i + 1} ({step.message_type === "text" ? "טקסט" : "הגדרות קבוצה"})
                </Label>
                <input
                  type="time"
                  value={times[step.id] ?? ""}
                  onChange={(e) => setTimes((prev) => ({ ...prev, [step.id]: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={runMut.isPending}>
            ביטול
          </Button>
          <Button onClick={() => runMut.mutate()} disabled={!canRun || runMut.isPending}>
            {runMut.isPending ? "מתזמן..." : "תזמן הכל"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Notes for the implementer:
- `runMut` deliberately awaits each `POST /api/whatsapp/scheduled` call
  sequentially in a `for...of` loop, not `Promise.all` — this matches the
  existing sequential-await style already used for multi-target dispatch in
  `src/app/api/cron/whatsapp-send/route.ts` (`dispatchToTarget`'s
  `coaches:all` branch), and keeps failure handling simple: the whole
  mutation rejects on the first failed step (partial schedules from earlier
  steps in the loop remain — same accepted "no rollback" posture the rest
  of this app already has for multi-step operations).
- `new Date(`${date}T${times[step.id]}`).toISOString()` is the exact same
  browser-local-time-to-UTC-ISO conversion technique the existing compose
  form already uses (`new Date(scheduledAt).toISOString()` on a
  `datetime-local` input's value in `whatsapp-scheduler.tsx`). Doing this
  client-side (in the browser, where the admin's local timezone is Israel
  time) rather than reconstructing the date server-side is deliberate —
  Vercel's Node runtime doesn't run in Israel's timezone, so building this
  same string server-side would silently produce times off by 2–3 hours.
  Do not move this computation to the API route.
- No new "run" API route is created — this reuses the existing
  `POST /api/whatsapp/scheduled` endpoint, once per step, exactly as if the
  admin had scheduled each step by hand in the compose tab.
- `times` state is seeded from each step's saved `time_of_day` (or `""` if
  none was saved), and stays fully editable — `canRun` requires every step
  to have a non-empty time value before the "תזמן הכל" button enables,
  regardless of whether that value came from the saved default or was typed
  fresh in this dialog.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Unused until Task 6 — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-automation-run-dialog.tsx
git commit -m "feat(whatsapp): add automation run dialog component"
```

---

### Task 6: Automations list panel component

**Files:**
- Create: `src/components/whatsapp-automations-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, ListChecks } from "lucide-react";
import { CreateAutomationDialog, EditAutomationDialog } from "@/components/whatsapp-automation-form";
import { RunAutomationDialog } from "@/components/whatsapp-automation-run-dialog";
import type { Automation } from "@/app/api/whatsapp/automations/route";

export function WhatsAppAutomationsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp:automations"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/automations");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { automations: Automation[] };
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/automations/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("אוטומציה נמחקה");
      qc.invalidateQueries({ queryKey: ["whatsapp:automations"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  const automations = data?.automations ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateAutomationDialog />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : automations.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          אין אוטומציות עדיין
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {automations.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-border/60 bg-card p-4 flex items-center justify-between gap-3 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ListChecks size={15} className="text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.steps.length} שלבים</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <RunAutomationDialog automation={a} />
                <EditAutomationDialog automation={a} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

This is the top-level piece Task 7 wires into the scheduler's new tab. The
delete button is guarded with `disabled={deleteMut.isPending}` from the
start (a lesson already applied from the earlier templates feature's code
review, where the equivalent button was initially missing this guard).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Not rendered anywhere yet — that's Task 7 — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-automations-panel.tsx
git commit -m "feat(whatsapp): add automations list panel component"
```

---

### Task 7: Wire the panel into a new "אוטומציות" tab

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Add the import**

Change:

```ts
import { WhatsAppTemplatesDialog } from "@/components/whatsapp-template-dialog";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";
```

to:

```ts
import { WhatsAppTemplatesDialog } from "@/components/whatsapp-template-dialog";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";
import { WhatsAppAutomationsPanel } from "@/components/whatsapp-automations-panel";
```

- [ ] **Step 2: Add the third tab trigger**

Change:

```ts
        <TabsList className="mb-5">
          <TabsTrigger value="scheduled">
            הודעות מתוזמנות
            {pending.length > 0 && (
              <span className="mr-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose">הודעה חדשה</TabsTrigger>
        </TabsList>
```

to:

```ts
        <TabsList className="mb-5">
          <TabsTrigger value="scheduled">
            הודעות מתוזמנות
            {pending.length > 0 && (
              <span className="mr-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="compose">הודעה חדשה</TabsTrigger>
          <TabsTrigger value="automations">אוטומציות</TabsTrigger>
        </TabsList>
```

- [ ] **Step 3: Add the new tab's content**

Find the end of the existing `compose` `TabsContent` block — it looks like
this (the closing tags of the compose tab, immediately before `</Tabs>`):

```ts
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Change it to:

```ts
          </div>
        </TabsContent>

        {/* ── Automations ── */}
        <TabsContent value="automations">
          <WhatsAppAutomationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

(This is the *last* occurrence of that closing pattern in the file — the
outermost `TabsContent value="compose"` block's end, right before the
`</Tabs>` that closes the whole `<Tabs>` component. Locate it by searching
for `</Tabs>` in the file; there's exactly one.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): add automations tab to the WhatsApp scheduler"
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

- [ ] **Step 3: Manual end-to-end verification**

Requires the `20260828_whatsapp_automations.sql` migration to have been
applied to the live database first (a human does this via the Supabase SQL
Editor — flag this clearly in your final report if it hasn't happened yet,
same as the templates feature's migration).

Once deployed and the migration is applied, in `/admin/whatsapp`:

1. Click the new "אוטומציות" tab — confirm it shows "אין אוטומציות עדיין".
2. Click "אוטומציה חדשה". Enter a name (e.g. "פתיחה וסגירה"). The form
   starts with one step — set its time to `19:00`, type is "טקסט", enter
   some message text. Click "הוסף שלב" to add a second step — set its time
   to `21:00`, switch its type to "הגדרות קבוצה", pick "סגור קבוצה". Save.
3. Confirm the automation now appears in the list, showing "2 שלבים".
4. Click "ערוך" — confirm both steps reload with their saved time, type,
   and content (text for step 1, the closed-group selection highlighted
   for step 2).
5. Click "הפעל" — confirm a group picker (WhatsApp groups only, no
   "מאמנים" option anywhere in this dialog), a date picker, and two time
   inputs (one per step) appear, pre-filled with `19:00`/`21:00` from the
   saved steps.
6. Pick a real test group and a near-future date, leave the pre-filled
   times as-is (or adjust them), click "תזמן הכל".
7. Go to the "הודעות מתוזמנות" tab — confirm **two** new pending rows now
   exist, targeting the picked group, at the two times you set on the
   picked date — one shown as a text message, one as "הגדרות קבוצה" /
   "סגירת קבוצה" (reusing the existing display logic from the templates
   feature's earlier work — no changes needed there for this to render
   correctly).
8. Delete the automation from the "אוטומציות" tab — confirm it disappears;
   confirm the two already-created `whatsapp_scheduled` rows from Step 7
   are **not** affected (they're independent rows now, per the design).

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check in Step 3 before considering the task
done. Explicitly flag if the migration hadn't been applied yet and some
steps couldn't be completed as a result.

---

## Plan Self-Review Notes

- **Spec coverage:** two-table data model with `payload` reusing the exact
  `whatsapp_scheduled.message` shape (Task 1), full CRUD API mirroring
  established conventions (Tasks 2–3), text/group_settings-only step types
  with optional saved `time_of_day` (Task 4), group-only recipient picker
  with per-step time inputs at run time reusing the existing scheduled-
  message endpoint with zero new "run" infrastructure (Task 5), the list
  UI (Task 6), and the new third tab (Task 7) are all implemented exactly
  per `docs/superpowers/specs/2026-08-27-whatsapp-automations-design.md`.
  All of the spec's explicit Out-of-Scope items (image/poll steps, storing
  a recipient on the automation, recurring auto-triggering, cross-day
  steps, editing step content from the run dialog) are correctly absent
  from every task.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `Automation`/`AutomationStep` are defined once, in
  Task 2's API route, and imported (not redefined) by Tasks 4, 5, and 6 —
  matching the `WhatsAppTemplate`/`ScheduledMessage` convention already
  established by the templates feature. `StepDraft`'s conversion functions
  (`stepFromApi`/`stepToPayload`) in Task 4 and the `payload` construction
  in Task 5's run dialog both independently produce/consume the identical
  `{ __type: "group_settings", allowParticipantsSendMessages }` JSON shape
  already defined by the (separate, already-shipped) group-settings
  scheduling feature — verified consistent across both tasks.
