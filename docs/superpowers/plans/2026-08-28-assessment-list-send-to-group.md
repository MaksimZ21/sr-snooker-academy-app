# Assessment List Send-to-Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant-send WhatsApp button on each row of the two assessment report list pages (admin and coach) with a small popover menu offering "שלח למשתתף" plus the same "מאסטר קלאס"-filtered WhatsApp group list already used by the full report detail page — without touching the detail page or the student detail page.

**Architecture:** One new shared client component, `AssessmentSendMenu`, owns the button, the popover, the group fetch (via TanStack Query, cached by query key across every row on the page), and both send code paths (personal / group) — each path replicating an existing, already-shipped behavior byte-for-byte (personal send matches the list pages' current `sendWhatsApp`; group send matches the detail view's current `sendToGroup`) rather than inventing new wording or flows. Both list pages then swap their inline button + local function for `<AssessmentSendMenu assessment={a} />`.

**Tech Stack:** TypeScript, Next.js 16, React 19, TanStack Query, `sonner` toasts, Tailwind CSS v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-28-assessment-list-send-to-group-design.md`

**Testing note:** This codebase does not unit-test `src/components/`. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual verification in the real UI.

---

### Task 1: Create the shared `AssessmentSendMenu` component

**Files:**
- Create: `src/components/assessment-send-menu.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Assessment } from "@/lib/sheets/assessment-types";

type WhatsAppGroup = { id: string; name: string };

async function fetchMasterClassGroups(): Promise<WhatsAppGroup[]> {
  const r = await fetch("/api/whatsapp/groups");
  if (!r.ok) throw new Error("failed to load groups");
  const { groups } = (await r.json()) as { groups: WhatsAppGroup[] };
  return groups.filter((g) =>
    g.name.includes("מאסטר קלאס") || g.name.toLowerCase().includes("master class"),
  );
}

async function sendToParticipant(a: Assessment) {
  if (!a.participant_phone) return;
  try {
    const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
    if (!tokenRes.ok) throw new Error();
    const { token } = (await tokenRes.json()) as { token: string };
    const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: a.participant_phone,
        urlFile: pdfUrl,
        fileName: `דוח אבחון - ${a.participant_name}.pdf`,
        caption: `שלום ${a.participant_name}, דוח האבחון שלך נמצא כאן`,
      }),
    });
    if (!r.ok) throw new Error();
    toast.success("נשלח ב-WhatsApp");
  } catch {
    toast.error("שגיאה בשליחה");
  }
}

async function sendToGroup(a: Assessment, group: WhatsAppGroup) {
  const toastId = toast.loading(`שולח ל${group.name}...`);
  try {
    const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
    if (!tokenRes.ok) throw new Error();
    const { token } = (await tokenRes.json()) as { token: string };
    const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: group.id,
        urlFile: pdfUrl,
        fileName: `דוח אבחון - ${a.participant_name}.pdf`,
        caption: `דוח אבחון - ${a.participant_name}`,
      }),
    });
    if (!r.ok) throw new Error();
    toast.success(`נשלח ל${group.name}`, { id: toastId });
  } catch {
    toast.error("שגיאה בשליחה", { id: toastId });
  }
}

export function AssessmentSendMenu({ assessment: a }: { assessment: Assessment }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["whatsapp:masterClassGroups"],
    queryFn: fetchMasterClassGroups,
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
        title="שלח ב-WhatsApp"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
      >
        <Send size={14} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-56 bg-popover border border-border/60 rounded-2xl shadow-lg overflow-hidden z-50"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {a.participant_phone && (
            <button
              type="button"
              onClick={() => { setOpen(false); sendToParticipant(a); }}
              className="w-full text-right flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-sm"
            >
              <Send size={14} className="text-emerald-500 shrink-0" />
              <span className="flex-1 truncate">שלח למשתתף</span>
            </button>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-4 border-t border-border/40 first:border-t-0">
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            </div>
          ) : groups && groups.length > 0 ? (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => { setOpen(false); sendToGroup(a, g); }}
                className="w-full text-right flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-sm border-t border-border/40 first:border-t-0"
              >
                <Users size={14} className="text-emerald-500 shrink-0" />
                <span className="flex-1 truncate">{g.name}</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border/40 first:border-t-0">
              לא נמצאו קבוצות מאסטר קלאס
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

Notes for the implementer:
- `onClick={(e) => { e.preventDefault(); e.stopPropagation(); ... }}` on the trigger button matches the existing codebase pattern for buttons nested inside a Next.js `<Link>` row (see the PDF-download link and old send button in both list pages) — `preventDefault()` stops the `<Link>` from navigating, `stopPropagation()` additionally stops the click from reaching any other ancestor handler. The popover's own wrapping `<div onClick={...}>` also calls both, so clicking inside the open popover (but not on one of its buttons) never triggers row navigation either.
- `enabled: open` + `staleTime: 60_000` means the groups fetch only happens the first time any row's menu is opened, and is shared (same `queryKey`) across every `AssessmentSendMenu` instance on the page — reopening any row's menu within 60s reuses the cached list instead of re-hitting `/api/whatsapp/groups`.
- `sendToParticipant` and `sendToGroup` intentionally use different toast styles (no loading toast vs. a loading→success/error toast) and different captions — this is not an inconsistency to fix, it's copied exactly from the two features' existing shipped behavior (list pages' old `sendWhatsApp`, and the detail view's existing `sendToGroup`) per the spec's "matches the existing detail-view behavior exactly" requirement.
- One cosmetic normalization versus the *old* per-file code: both list pages previously had slightly different wording for the personal-send success/error toasts (`"נשלח"` vs `"נשלח ב-WhatsApp"`, `"שגיאה"` vs `"שגיאה בשליחה"`). Since this is now one shared component, this plan standardizes on `"נשלח ב-WhatsApp"` / `"שגיאה בשליחה"` — matching the detail view's existing personal-send wording — rather than picking one list page's wording arbitrarily.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (it isn't imported anywhere yet, so it can't affect other files' compilation, but the file itself must type-check cleanly — in particular, `Assessment`'s `participant_phone` field must be checked for its exact type in `src/lib/sheets/assessment-types.ts` beforehand; if it's typed as `string | null` rather than `string | undefined`, the `{a.participant_phone && (...)}` guard and the `sendToParticipant`/`onClick` usage still work correctly either way, no change needed).

- [ ] **Step 3: Commit**

```bash
git add src/components/assessment-send-menu.tsx
git commit -m "feat(assessments): add shared send-to-participant-or-group menu component"
```

---

### Task 2: Wire into the admin assessments list

**Files:**
- Modify: `src/app/(admin)/admin/assessments/page.tsx`

- [ ] **Step 1: Update imports**

Change:
```ts
import { FileText, Plus, Search, Send, ChevronLeft } from "lucide-react";
```
to:
```ts
import { FileText, Plus, Search, ChevronLeft } from "lucide-react";
```
(`Send` is no longer used directly in this file — it now lives inside `AssessmentSendMenu`.)

Add a new import line (after the existing `PageHeader`/`toast`/`assessment-types` imports):
```ts
import { AssessmentSendMenu } from "@/components/assessment-send-menu";
```

- [ ] **Step 2: Remove the old `sendWhatsApp` function**

Delete this whole function (it's fully superseded by `AssessmentSendMenu`'s internal `sendToParticipant`):
```ts
async function sendWhatsApp(a: Assessment) {
  if (!a.participant_phone) { toast.error("אין מספר טלפון"); return; }
  const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
  if (!tokenRes.ok) { toast.error("שגיאה ביצירת קישור"); return; }
  const { token } = await tokenRes.json() as { token: string };
  const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
  const r = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phone: a.participant_phone,
      urlFile: pdfUrl,
      fileName: `דוח אבחון - ${a.participant_name}.pdf`,
      caption: `שלום ${a.participant_name}, דוח האבחון שלך נמצא כאן`,
    }),
  });
  if (r.ok) toast.success("נשלח"); else toast.error("שגיאה");
}
```

Leave `toast` imported and used elsewhere in the file if it's still referenced (check before removing the `import { toast } from "sonner";` line — if this was the only usage, remove that import too; if `toast` is used anywhere else in this file, keep the import).

- [ ] **Step 3: Replace the send button with the new menu**

Change:
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
to:
```tsx
                    <AssessmentSendMenu assessment={a} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in this file. If `toast` or `Send` are reported as unused imports, remove them (per Step 1/2 notes above).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/admin/assessments/page.tsx"
git commit -m "feat(assessments): use send-to-group menu on the admin assessments list"
```

---

### Task 3: Wire into the coach assessments list

**Files:**
- Modify: `src/app/(coach)/coach/assessments/page.tsx`

- [ ] **Step 1: Update imports**

Change:
```ts
import { FileText, Plus, Send, ChevronLeft } from "lucide-react";
```
to:
```ts
import { FileText, Plus, ChevronLeft } from "lucide-react";
```

Add:
```ts
import { AssessmentSendMenu } from "@/components/assessment-send-menu";
```

- [ ] **Step 2: Remove the old `sendWhatsApp` function**

Delete this whole function:
```ts
async function sendWhatsApp(a: Assessment) {
  if (!a.participant_phone) {
    toast.error("אין מספר טלפון למשתתף זה");
    return;
  }
  const tokenRes = await fetch(`/api/assessments/${a.id}/share-token`);
  if (!tokenRes.ok) { toast.error("שגיאה ביצירת קישור"); return; }
  const { token } = await tokenRes.json() as { token: string };
  const pdfUrl = `${window.location.origin}/api/assessments/${a.id}/pdf?token=${token}`;
  const r = await fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phone: a.participant_phone,
      urlFile: pdfUrl,
      fileName: `דוח אבחון - ${a.participant_name}.pdf`,
      caption: `שלום ${a.participant_name}, דוח האבחון שלך נמצא כאן`,
    }),
  });
  if (r.ok) toast.success("נשלח ב-WhatsApp");
  else toast.error("שגיאה בשליחה");
}
```

Same note as Task 2 Step 2 regarding the `toast` import — keep it only if still used elsewhere in the file.

- [ ] **Step 3: Replace the send button with the new menu**

Change:
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
to:
```tsx
                      <AssessmentSendMenu assessment={a} />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(coach)/coach/assessments/page.tsx"
git commit -m "feat(assessments): use send-to-group menu on the coach assessments list"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full project typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Run the test suite**

Run: `npm run test:run`
Expected: all existing tests still pass (this feature touches no tested files).

- [ ] **Step 3: Manual end-to-end verification**

Once deployed, on both `/admin/assessments` and `/coach/assessments`:

1. Hover a row and click the send (paper-plane) icon — confirm a small popover opens below it instead of sending immediately, and the row itself does not navigate to the detail page.
2. If the report has a participant phone, confirm "שלח למשתתף" appears at the top of the popover; if it doesn't, confirm that row's popover simply skips straight to the group section (no error toast, no empty row).
3. Confirm the group section shows a brief spinner the first time any popover is opened on the page, then lists the "מאסטר קלאס"-matching group(s); opening a different row's popover shortly after should show the list immediately (no repeat spinner) since it's cached.
4. Click "שלח למשתתף" — confirm a WhatsApp message arrives at that phone with the report PDF, and a "נשלח ב-WhatsApp" toast appears (or "שגיאה בשליחה" if it fails).
5. Click a group name — confirm a "שולח ל<שם קבוצה>..." loading toast appears, then resolves to "נשלח ל<שם קבוצה>" once the group receives the PDF.
6. Click outside an open popover — confirm it closes without sending anything.
7. **Layout check:** open the popover on the *last* row of a list (bottom of the card) — the card container uses `overflow-hidden` on its rounded corners, so confirm the popover isn't visually clipped there. If it is, flag it — the fix would be switching that row's popover to open upward (`bottom-full` instead of `top-full`, matching how the full detail page's own group picker already opens), but that isn't applied preemptively here since it may not be needed depending on real list lengths/viewport.
8. Confirm `assessment-detail-view.tsx`'s existing two buttons ("WhatsApp אישי" / "שלח לקבוצת מאסטר קלאס") and the student detail page are visually and functionally unchanged.

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check in Step 3 before considering the task done, and explicitly call out the Step 3.7 layout check result since it's the one open risk this plan doesn't preemptively engineer around.

---

## Plan Self-Review Notes

- **Spec coverage:** every item in the spec's "New Behavior" and "Architecture" sections maps to Task 1 (component) and Tasks 2–3 (wiring); "Error Handling" is satisfied by copying the two existing, already-shipped code paths verbatim rather than inventing new messages; "Out of Scope" items (detail view, student page, non-Master-Class groups, combined single-click send) are all correctly left untouched — no task modifies `assessment-detail-view.tsx` or `admin/students/[id]/page.tsx`.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `AssessmentSendMenu`'s prop is `{ assessment: Assessment }` and both call sites pass `<AssessmentSendMenu assessment={a} />` with `a: Assessment` from the same `@/lib/sheets/assessment-types` import already used in both files — no naming drift.
- **One deliberate, documented normalization:** the two list pages' previously-inconsistent personal-send toast wording is unified to match the detail view's existing wording, called out explicitly in Task 1 so it isn't mistaken for an oversight.
