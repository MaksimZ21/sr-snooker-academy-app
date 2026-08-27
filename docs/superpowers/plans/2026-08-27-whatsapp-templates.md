# WhatsApp Message Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin save, edit, and reuse named WhatsApp message templates (with `{{placeholder}}` fill-in-the-blanks) directly from the existing "הודעה חדשה" compose tab, for text messages, image captions, and poll questions alike.

**Architecture:** One new table (`whatsapp_templates`) and a matching CRUD API, mirroring the existing `whatsapp_scheduled` table/API conventions exactly (same file layout, same auth pattern, `db` queried directly in the route — this subsystem doesn't use the `src/lib/sheets/` module layer, and this plan matches that existing local convention rather than the general one). Two new focused components — a management dialog and a reusable picker-with-live-substitution widget — get composed into the existing (already large) `whatsapp-scheduler.tsx` rather than growing that file's own logic further.

**Tech Stack:** TypeScript, Next.js 16 API routes, Supabase, React 19 + TanStack Query, shadcn/ui (`Dialog`, `Select`).

**Spec:** `docs/superpowers/specs/2026-08-27-whatsapp-templates-design.md`

**Testing note:** This codebase does not unit-test Supabase-backed API routes or `src/components/` — only pure-logic files have vitest coverage. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual end-to-end verification in the real admin UI.

---

### Task 1: `whatsapp_templates` table migration

**Files:**
- Create: `supabase/migrations/20260827_whatsapp_templates.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE whatsapp_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
```

This matches `supabase/migrations/20260615_whatsapp_scheduled.sql`'s exact
style (same column formatting, RLS enabled the same way).

- [ ] **Step 2: Apply it**

This project has no migration runner wired up — migrations are applied
manually via the Supabase SQL Editor. Open the Supabase dashboard for this
project, paste the contents of the new file into the SQL Editor, and run it.
Confirm the `whatsapp_templates` table now exists (Table Editor, or
`select * from whatsapp_templates;` in the SQL Editor — should return 0
rows, no error).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260827_whatsapp_templates.sql
git commit -m "feat(whatsapp): add whatsapp_templates table migration"
```

---

### Task 2: Templates list/create API

**Files:**
- Create: `src/app/api/whatsapp/templates/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type WhatsAppTemplate = {
  id: string;
  name: string;
  body: string;
  created_at: string;
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data } = await db
      .from("whatsapp_templates")
      .select("*")
      .order("name", { ascending: true });
    return NextResponse.json({ templates: (data ?? []) as WhatsAppTemplate[] });
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
        body: z.string().min(1),
      })
      .parse(await req.json());
    const { data } = await db.from("whatsapp_templates").insert(body).select().single();
    return NextResponse.json({ template: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

This mirrors `src/app/api/whatsapp/scheduled/route.ts` exactly (same
`requireUser`/role-check/try-catch shape, same direct `db.from(...)` use —
no `src/lib/sheets/` module, matching how the sibling scheduled-messages
route already works).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/templates/route.ts
git commit -m "feat(whatsapp): add templates list/create API route"
```

---

### Task 3: Template edit/delete API

**Files:**
- Create: `src/app/api/whatsapp/templates/[id]/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

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
        body: z.string().min(1),
      })
      .parse(await req.json());
    await db.from("whatsapp_templates").update(body).eq("id", id);
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
    await db.from("whatsapp_templates").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

This mirrors `src/app/api/whatsapp/scheduled/[id]/route.ts`'s shape (same
`requireUser`/role-check/params pattern). Unlike that route, `DELETE` here
has no `.eq("status", "pending")` filter — templates don't have a status
concept, any template can be deleted at any time.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/whatsapp/templates/[id]/route.ts"
git commit -m "feat(whatsapp): add template edit/delete API route"
```

---

### Task 4: Template management dialog component

**Files:**
- Create: `src/components/whatsapp-template-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import type { WhatsAppTemplate } from "@/app/api/whatsapp/templates/route";

async function fetchTemplates(): Promise<WhatsAppTemplate[]> {
  const r = await fetch("/api/whatsapp/templates");
  if (!r.ok) throw new Error("fetch failed");
  const json = (await r.json()) as { templates: WhatsAppTemplate[] };
  return json.templates;
}

function TemplateForm({
  template,
  onDone,
}: {
  template?: WhatsAppTemplate;
  onDone: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const r = template
        ? await fetch(`/api/whatsapp/templates/${template.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, body }),
          })
        : await fetch("/api/whatsapp/templates", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, body }),
          });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success(template ? "תבנית עודכנה" : "תבנית נוצרה");
      qc.invalidateQueries({ queryKey: ["whatsapp:templates"] });
      onDone();
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">שם התבנית</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="תזכורת אימון" dir="auto" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">טקסט</Label>
        <Textarea
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"לדוגמה: תזכורת לאימון ב-{{תאריך}} בשעה {{שעה}}"}
          className="resize-y text-sm leading-relaxed"
          dir="auto"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mut.isPending}>
          ביטול
        </Button>
        <Button onClick={() => mut.mutate()} disabled={!name.trim() || !body.trim() || mut.isPending}>
          {mut.isPending ? "שומר..." : "שמור"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function WhatsAppTemplatesDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<WhatsAppTemplate | undefined>(undefined);
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp:templates"],
    queryFn: fetchTemplates,
    enabled: open,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
    },
    onSuccess: () => {
      toast.success("תבנית נמחקה");
      qc.invalidateQueries({ queryKey: ["whatsapp:templates"] });
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode("list");
      setEditing(undefined);
    }
  }

  function openCreate() {
    setEditing(undefined);
    setMode("form");
  }

  function openEdit(t: WhatsAppTemplate) {
    setEditing(t);
    setMode("form");
  }

  function backToList() {
    setMode("list");
    setEditing(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
        <FileText className="ml-2 h-4 w-4" />
        תבניות
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "list" ? "תבניות הודעה" : editing ? "עריכת תבנית" : "תבנית חדשה"}</DialogTitle>
        </DialogHeader>

        {mode === "form" ? (
          <TemplateForm template={editing} onDone={backToList} />
        ) : (
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">טוען...</div>
            ) : (templates ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">אין תבניות עדיין</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {(templates ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMut.mutate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={openCreate}>
                <Plus className="ml-2 h-4 w-4" />
                תבנית חדשה
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

This follows `src/components/forms/group-dialog.tsx`'s exact conventions
(`Dialog`/`DialogTrigger render={...}`/`DialogFooter`, mutation +
`toast` + `queryClient.invalidateQueries` pattern), combined into a single
dialog with a `list`/`form` mode switch per the spec (no separate page, no
separate create-vs-edit dialog components). The `WhatsAppTemplate` type is
imported from the Task 2 API route rather than redefined here, matching how
`whatsapp-scheduler.tsx` already imports `ScheduledMessage` from its own API
route (`import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";`)
— the established convention in this exact file family.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This component isn't imported/rendered anywhere yet —
that's Task 6 — so it being unused is expected and fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-template-dialog.tsx
git commit -m "feat(whatsapp): add template management dialog component"
```

---

### Task 5: Template picker with live placeholder substitution

**Files:**
- Create: `src/components/whatsapp-template-picker.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WhatsAppTemplate } from "@/app/api/whatsapp/templates/route";

function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(/\{\{([^}]+)\}\}/g)) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function WhatsAppTemplatePicker({ onApply }: { onApply: (text: string) => void }) {
  const { data } = useQuery({
    queryKey: ["whatsapp:templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) throw new Error("fetch failed");
      const json = (await r.json()) as { templates: WhatsAppTemplate[] };
      return json.templates;
    },
  });
  const templates = data ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === selectedId);
  const placeholders = selected ? extractPlaceholders(selected.body) : [];

  function handleSelect(id: string) {
    setSelectedId(id);
    setPlaceholderValues({});
    const t = templates.find((t) => t.id === id);
    if (t) onApply(t.body);
  }

  function handlePlaceholderChange(name: string, value: string) {
    if (!selected) return;
    const next = { ...placeholderValues, [name]: value };
    setPlaceholderValues(next);
    let result = selected.body;
    for (const p of extractPlaceholders(selected.body)) {
      result = result.replaceAll(`{{${p}}}`, next[p] ?? "");
    }
    onApply(result);
  }

  if (templates.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Select value={selectedId || "__none__"} onValueChange={(v) => handleSelect(!v || v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="טען תבנית..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">ללא תבנית</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {placeholders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 p-2">
          {placeholders.map((p) => (
            <div key={p}>
              <Label className="text-xs text-muted-foreground mb-1 block">{p}</Label>
              <Input
                value={placeholderValues[p] ?? ""}
                onChange={(e) => handlePlaceholderChange(p, e.target.value)}
                className="h-8 text-sm"
                dir="auto"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- `extractPlaceholders` returns unique placeholder names in first-occurrence
  order, per the spec (`{{תאריך}}` and `{{שעה}}` each produce exactly one
  input field, no duplicates even if a name repeats in the body).
- `handlePlaceholderChange` always recomputes `result` from `selected.body`
  from scratch (not by patching the previous output) — this is the
  "Substitution mechanics" behavior documented in the spec: the displayed
  text is a pure function of the template + current placeholder values every
  time, not an incremental patch.
- Selecting `"__none__"` ("ללא תבנית") calls `setSelectedId("")` but does
  **not** call `onApply` — per spec, switching to "no template" leaves
  whatever text is already in the target field untouched.
- Renders nothing (`return null`) when there are no templates yet, so it
  doesn't clutter the compose form before the admin has created any —
  they still have Task 4's "תבניות" button to create one.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Also unused until Task 6 — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/components/whatsapp-template-picker.tsx
git commit -m "feat(whatsapp): add template picker with live placeholder substitution"
```

---

### Task 6: Wire both components into the compose tab

**Files:**
- Modify: `src/components/whatsapp-scheduler.tsx`

- [ ] **Step 1: Add the imports**

Change:

```ts
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";
```

to:

```ts
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScheduledMessage } from "@/app/api/whatsapp/scheduled/route";
import { WhatsAppTemplatesDialog } from "@/components/whatsapp-template-dialog";
import { WhatsAppTemplatePicker } from "@/components/whatsapp-template-picker";
```

- [ ] **Step 2: Add a `composeKey` that increments on every successful reset**

Change:

```ts
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

to:

```ts
  const [groupOpen, setGroupOpen] = useState<boolean | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [composeKey, setComposeKey] = useState(0);

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
    setComposeKey((k) => k + 1);
  }
```

`composeKey` is passed as the `key` prop on every `WhatsAppTemplatePicker`
instance below (Steps 4–6). Bumping it on reset forces React to fully
remount those instances after a successful submit, so a previously-selected
template and its filled-in placeholder values don't linger visually once
the underlying `text`/`imageCaption`/`pollQuestion` state has already been
cleared by `resetCompose`.

- [ ] **Step 3: Add the "תבניות" button next to the "הודעה" section header**

Change:

```ts
            {/* Message */}
            <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-4 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">הודעה</p>
```

to:

```ts
            {/* Message */}
            <section className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col gap-4 shadow-sm shadow-foreground/[0.03] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">הודעה</p>
                <WhatsAppTemplatesDialog />
              </div>
```

- [ ] **Step 4: Add the picker above the text message field**

Change:

```ts
              {/* Text */}
              {msgType === "text" && (
                <Textarea
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="כתוב את ההודעה..."
                  className="resize-y text-sm leading-relaxed min-h-[120px]"
                  dir="auto"
                />
              )}
```

to:

```ts
              {/* Text */}
              {msgType === "text" && (
                <div className="flex flex-col gap-2">
                  <WhatsAppTemplatePicker key={composeKey} onApply={setText} />
                  <Textarea
                    rows={10}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="כתוב את ההודעה..."
                    className="resize-y text-sm leading-relaxed min-h-[120px]"
                    dir="auto"
                  />
                </div>
              )}
```

- [ ] **Step 5: Add the picker above the image caption field**

Change:

```ts
                  {/* Caption */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">כיתוב (אופציונלי)</Label>
                    <Textarea
                      rows={4}
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      placeholder="טקסט שיופיע מתחת לתמונה..."
                      className="resize-none text-sm"
                      dir="auto"
                    />
                  </div>
```

to:

```ts
                  {/* Caption */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">כיתוב (אופציונלי)</Label>
                    <WhatsAppTemplatePicker key={composeKey} onApply={setImageCaption} />
                    <Textarea
                      rows={4}
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      placeholder="טקסט שיופיע מתחת לתמונה..."
                      className="resize-none text-sm mt-2"
                      dir="auto"
                    />
                  </div>
```

- [ ] **Step 6: Add the picker above the poll question field**

Change:

```ts
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שאלת הסקר</Label>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="מה השאלה?"
                    dir="auto"
                    className="text-sm"
                  />
                </div>
```

to:

```ts
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">שאלת הסקר</Label>
                  <WhatsAppTemplatePicker key={composeKey} onApply={setPollQuestion} />
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="מה השאלה?"
                    dir="auto"
                    className="text-sm mt-2"
                  />
                </div>
```

This is inside the existing `{msgType === "poll" && (...)}` block, right at
its start (immediately after the opening `<div className="flex flex-col gap-3">`).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/whatsapp-scheduler.tsx
git commit -m "feat(whatsapp): wire template picker and manager into compose tab"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature touches no tested
files, so the count shouldn't change from whatever the baseline is).

- [ ] **Step 3: Manual end-to-end verification**

Once deployed, in `/admin/whatsapp` → "הודעה חדשה":

1. Click "תבניות" next to the "הודעה" label — confirm the dialog opens
   showing "אין תבניות עדיין".
2. Click "תבנית חדשה", enter a name (e.g. "תזכורת") and a body containing
   two placeholders, e.g. `תזכורת לאימון ב-{{תאריך}} בשעה {{שעה}}`. Save.
   Confirm it now appears in the list, and the dialog can be closed.
3. With message type "טקסט" selected, confirm a "טען תבנית" dropdown now
   appears above the text box, listing the new template.
4. Select it — confirm the text box fills with the raw template text
   (markers still visible), and two input fields appear labeled "תאריך" and
   "שעה".
5. Type into both — confirm the text box updates live, replacing each
   `{{...}}` marker with what was typed.
6. Manually edit the text box directly afterward (e.g. add a sentence) —
   confirm it's freely editable.
7. Switch message type to "תמונה", then back to "טקסט" — confirm the
   template picker resets (shows "טען תבנית" placeholder again, no stale
   selection) since this remounts the field.
8. Repeat template selection once for "תמונה" (caption field) and once for
   "סקר" (question field) — confirm the same picker behavior works in both.
9. Schedule a message using a filled-in template, submit successfully,
   confirm the compose form clears and — if you return to "טקסט" — the
   template picker shows no stale selection (composeKey remount working).
10. Back in "תבניות", edit the saved template's text, confirm the change
    persists on reopening; delete it, confirm it disappears from both the
    management dialog and the "טען תבנית" dropdown.

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check in Step 3 before considering the task
done.

---

## Plan Self-Review Notes

- **Spec coverage:** `whatsapp_templates` table (Task 1), full CRUD API
  (Tasks 2–3), inline dialog-based management with no dedicated page (Task
  4), live placeholder detection/substitution usable across all three
  message-compose fields (Tasks 5–6), and the "substitution mechanics"
  clarification added to the spec (recompute-from-template-body-each-time,
  not incremental patching) are all implemented exactly as specified.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `WhatsAppTemplate` is defined exactly once, in Task 2's API route (`{ id, name, body, created_at }`), and imported by both Task 4's dialog and Task 5's picker — no redefinition, no drift, matching this codebase's existing `ScheduledMessage` convention.
