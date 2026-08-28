# Assessment Technique Medium Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "medium" rating to the assessment technique grid (currently good/bad only), across the compose form, the detail view, and the PDF export — with existing saved reports (which only ever have `true`/`false`) continuing to display correctly, unchanged.

**Architecture:** `technique` is stored as flexible JSON, so no database migration is needed — this is purely a TypeScript type change (`boolean` → `"good" | "medium" | "bad"`) plus one shared normalization helper (`normalizeTechniqueRating`) that maps legacy `true`/`false` values into the new three-state shape wherever old data is read. New writes always use the three string values; old data is never touched or migrated.

**Tech Stack:** TypeScript, Next.js 16, Zod, React 19, `@react-pdf/renderer`.

**Spec:** `docs/superpowers/specs/2026-08-28-assessment-medium-rating-design.md`

**Testing note:** This codebase does not unit-test `src/lib/sheets/` modules, API routes, or `src/components/`. `npx tsc --noEmit` is the automated gate for each step; the final task covers manual verification in the real UI, specifically including a check that an *existing* (pre-change) saved report still renders correctly.

---

### Task 1: Add `TechniqueRating` type and normalization helper

**Files:**
- Modify: `src/lib/sheets/assessment-types.ts`

- [ ] **Step 1: Change the `Technique` type and add the helper**

Change:

```ts
export type Technique = Partial<Record<TechniqueKey, boolean>>;
```

to:

```ts
export type TechniqueRating = "good" | "medium" | "bad";

export type Technique = Partial<Record<TechniqueKey, TechniqueRating>>;

// Existing saved assessments store `true`/`false` per criterion (the old
// two-state rating). New assessments always save one of the three
// TechniqueRating strings below. This normalizes either shape into the
// current three-state type for display — old reports simply never have a
// "medium" entry, so they render exactly as they always have.
export function normalizeTechniqueRating(
  raw: boolean | TechniqueRating | undefined,
): TechniqueRating | undefined {
  if (raw === true) return "good";
  if (raw === false) return "bad";
  return raw;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in other files that still assume `boolean` (`assessment-form.tsx`, `assessment-detail-view.tsx`, `assessment-pdf.tsx`, `src/app/api/assessments/route.ts`) — this is expected at this point in the plan; those get fixed in later tasks. Confirm the errors are ONLY in those files and are about the `Technique`/`TechniqueRating` type mismatch, not something unrelated.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/assessment-types.ts
git commit -m "feat(assessments): add TechniqueRating type and normalization helper"
```

---

### Task 2: Re-export from `assessments.ts`

**Files:**
- Modify: `src/lib/sheets/assessments.ts`

- [ ] **Step 1: Add the new exports**

Change:

```ts
export type { TechniqueKey, Technique, Assessment } from "./assessment-types";
export { TECHNIQUE_CRITERIA } from "./assessment-types";
```

to:

```ts
export type { TechniqueKey, Technique, TechniqueRating, Assessment } from "./assessment-types";
export { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "./assessment-types";
```

`src/components/assessment-pdf.tsx` imports `TECHNIQUE_CRITERIA`/`Assessment`
from `@/lib/sheets/assessments` (not directly from `assessment-types`) — this
re-export is what makes `normalizeTechniqueRating` reachable from there in
Task 6.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: same set of pre-existing errors as Task 1 (this step doesn't fix
any of them, just makes the new export reachable from the other import
path) — no NEW errors introduced by this change itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/assessments.ts
git commit -m "feat(assessments): re-export TechniqueRating and normalizeTechniqueRating"
```

---

### Task 3: Update server-side validation

**Files:**
- Modify: `src/app/api/assessments/route.ts`

- [ ] **Step 1: Change the zod schema**

Change:

```ts
const TechniqueSchema = z.record(z.string(), z.boolean());
```

to:

```ts
const TechniqueSchema = z.record(z.string(), z.enum(["good", "medium", "bad"]));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: this file's own error (if any) is now resolved; errors remain in
`assessment-form.tsx`, `assessment-detail-view.tsx`, `assessment-pdf.tsx`
until Tasks 4–6.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assessments/route.ts
git commit -m "feat(assessments): accept medium rating in technique validation"
```

---

### Task 4: Compose form — three-state UI

**Files:**
- Modify: `src/components/assessment-form.tsx`

- [ ] **Step 1: Update imports**

Change:

```ts
import { Check, X, Camera, ChevronDown, ChevronUp } from "lucide-react";
```

to:

```ts
import { Check, Circle, X, Camera, ChevronDown, ChevronUp } from "lucide-react";
```

Change:

```ts
import { TECHNIQUE_CRITERIA, type TechniqueKey } from "@/lib/sheets/assessment-types";
```

to:

```ts
import { TECHNIQUE_CRITERIA, type TechniqueKey, type TechniqueRating } from "@/lib/sheets/assessment-types";
```

- [ ] **Step 2: Update the `technique` state type**

Change:

```ts
  const [technique,        setTechnique]        = useState<Partial<Record<TechniqueKey, boolean>>>({});
```

to:

```ts
  const [technique,        setTechnique]        = useState<Partial<Record<TechniqueKey, TechniqueRating>>>({});
```

- [ ] **Step 3: Update `setTech`**

Change:

```ts
  function setTech(key: TechniqueKey, value: boolean) {
    setTechnique((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }
```

to:

```ts
  function setTech(key: TechniqueKey, value: TechniqueRating) {
    setTechnique((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }
```

- [ ] **Step 4: Replace the two-count summary with a three-count summary**

Change:

```ts
  const ratedCount = Object.keys(technique).length;
  const passCount  = Object.values(technique).filter(Boolean).length;
```

to:

```ts
  const goodCount   = Object.values(technique).filter((v) => v === "good").length;
  const mediumCount = Object.values(technique).filter((v) => v === "medium").length;
  const badCount    = Object.values(technique).filter((v) => v === "bad").length;
  const ratedCount  = goodCount + mediumCount + badCount;
```

- [ ] **Step 5: Update the summary badge JSX**

Change:

```ts
            {ratedCount > 0 && (
              <span className="text-xs text-muted-foreground">{passCount}/{ratedCount} ✓</span>
            )}
```

to:

```ts
            {ratedCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                ✓ {goodCount}　○ {mediumCount}　✗ {badCount}
              </span>
            )}
```

- [ ] **Step 6: Add the third (medium) button to each criterion row**

Change:

```ts
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTech(c.key, true)}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === true ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600",
                      )}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTech(c.key, false)}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === false ? "bg-red-500 border-red-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-red-400 hover:text-red-600",
                      )}
                    >
                      <X size={14} />
                    </button>
                  </div>
```

to:

```ts
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTech(c.key, "good")}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === "good" ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600",
                      )}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTech(c.key, "medium")}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === "medium" ? "bg-amber-500 border-amber-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-amber-400 hover:text-amber-600",
                      )}
                    >
                      <Circle size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTech(c.key, "bad")}
                      className={cn(
                        "h-8 w-8 rounded-lg border transition-all duration-150 flex items-center justify-center",
                        val === "bad" ? "bg-red-500 border-red-500 text-white shadow-sm" : "border-border/60 text-muted-foreground hover:border-red-400 hover:text-red-600",
                      )}
                    >
                      <X size={14} />
                    </button>
                  </div>
```

Note: `const val = technique[c.key];` (a few lines above this block) does not
need to change — its type now automatically follows from the updated
`technique` state type.

This form is create-only (no `assessment` prop to pre-fill from an existing
saved report), so it never needs `normalizeTechniqueRating` — every value it
ever holds was set by one of these three buttons in this same session.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: this file's errors are now resolved; errors remain in
`assessment-detail-view.tsx` and `assessment-pdf.tsx` until Tasks 5–6.

- [ ] **Step 8: Commit**

```bash
git add src/components/assessment-form.tsx
git commit -m "feat(assessments): add medium rating button to the compose form"
```

---

### Task 5: Detail view — three-state display

**Files:**
- Modify: `src/components/assessment-detail-view.tsx`

- [ ] **Step 1: Update imports**

Change:

```ts
import { ArrowRight, FileText, Send, CheckCircle2, XCircle, Minus, Users, Loader2, ChevronDown } from "lucide-react";
```

to:

```ts
import { ArrowRight, FileText, Send, CheckCircle2, Circle, XCircle, Minus, Users, Loader2, ChevronDown } from "lucide-react";
```

Change:

```ts
import { TECHNIQUE_CRITERIA, type Assessment } from "@/lib/sheets/assessment-types";
```

to:

```ts
import { TECHNIQUE_CRITERIA, normalizeTechniqueRating, type Assessment } from "@/lib/sheets/assessment-types";
```

- [ ] **Step 2: Replace the two-count summary with a three-count summary**

Change:

```ts
  const { assessment: a } = data;
  const passCount = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true).length;
  const ratedCount = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] !== undefined).length;
```

to:

```ts
  const { assessment: a } = data;
  const techniqueRatings = TECHNIQUE_CRITERIA.map((c) => normalizeTechniqueRating(a.technique[c.key]));
  const goodCount   = techniqueRatings.filter((r) => r === "good").length;
  const mediumCount = techniqueRatings.filter((r) => r === "medium").length;
  const badCount    = techniqueRatings.filter((r) => r === "bad").length;
  const ratedCount  = goodCount + mediumCount + badCount;
```

- [ ] **Step 3: Update the header summary badge JSX**

Change:

```ts
            {ratedCount > 0 && (
              <span className="bg-white/20 text-white font-semibold text-xs px-2.5 py-1 rounded-full tabular-nums">
                {passCount}/{ratedCount} עברו
              </span>
            )}
```

to:

```ts
            {ratedCount > 0 && (
              <span className="bg-white/20 text-white font-semibold text-xs px-2.5 py-1 rounded-full tabular-nums">
                ✓{goodCount} ○{mediumCount} ✗{badCount}
              </span>
            )}
```

- [ ] **Step 4: Update the per-row icon logic**

Change:

```ts
            {TECHNIQUE_CRITERIA.map((c) => {
              const val = a.technique[c.key];
              return (
                <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm">{c.label}</span>
                  {val === undefined ? (
                    <Minus size={15} className="text-muted-foreground/30 shrink-0" />
                  ) : val ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                </div>
              );
            })}
```

to:

```ts
            {TECHNIQUE_CRITERIA.map((c) => {
              const val = normalizeTechniqueRating(a.technique[c.key]);
              return (
                <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm">{c.label}</span>
                  {val === undefined ? (
                    <Minus size={15} className="text-muted-foreground/30 shrink-0" />
                  ) : val === "good" ? (
                    <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  ) : val === "medium" ? (
                    <Circle size={18} className="text-amber-500 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                </div>
              );
            })}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: this file's errors are now resolved; errors remain in
`assessment-pdf.tsx` until Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/components/assessment-detail-view.tsx
git commit -m "feat(assessments): show medium rating in the detail view"
```

---

### Task 6: PDF export — three-state sections

**Files:**
- Modify: `src/components/assessment-pdf.tsx`

- [ ] **Step 1: Import the normalization helper**

Change:

```ts
import type { Assessment } from "@/lib/sheets/assessments";
import { TECHNIQUE_CRITERIA } from "@/lib/sheets/assessments";
```

to:

```ts
import type { Assessment } from "@/lib/sheets/assessments";
import { TECHNIQUE_CRITERIA, normalizeTechniqueRating } from "@/lib/sheets/assessments";
```

- [ ] **Step 2: Add amber color constants**

Change:

```ts
const GREEN       = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const RED         = "#cc2222";
const LIGHT_RED   = "#fff0f0";
const BORDER      = "#d0e8db";
```

to:

```ts
const GREEN       = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const RED         = "#cc2222";
const LIGHT_RED   = "#fff0f0";
const AMBER       = "#b8790b";
const LIGHT_AMBER = "#fdf3e3";
const BORDER      = "#d0e8db";
```

- [ ] **Step 3: Add amber section-header style**

Change:

```ts
  sectionHeaderGreen: { backgroundColor: GREEN },
  sectionHeaderRed:   { backgroundColor: RED },
```

to:

```ts
  sectionHeaderGreen: { backgroundColor: GREEN },
  sectionHeaderRed:   { backgroundColor: RED },
  sectionHeaderAmber: { backgroundColor: AMBER },
```

- [ ] **Step 4: Add amber row/mark styles**

Change:

```ts
  techRowGreen: { backgroundColor: LIGHT_GREEN },
  techRowRed:   { backgroundColor: LIGHT_RED },
  techLabel:    { flex: 1, textAlign: "right", color: "#333" },
  techMark:     { width: 20, textAlign: "center", fontWeight: 700, fontSize: 11 },
  markGreen:    { color: GREEN },
  markRed:      { color: RED },
```

to:

```ts
  techRowGreen: { backgroundColor: LIGHT_GREEN },
  techRowRed:   { backgroundColor: LIGHT_RED },
  techRowAmber: { backgroundColor: LIGHT_AMBER },
  techLabel:    { flex: 1, textAlign: "right", color: "#333" },
  techMark:     { width: 20, textAlign: "center", fontWeight: 700, fontSize: 11 },
  markGreen:    { color: GREEN },
  markRed:      { color: RED },
  markAmber:    { color: AMBER },
```

- [ ] **Step 5: Compute `mediumItems` alongside the existing lists**

Change:

```ts
  const strongItems = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true);
  const weakItems   = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === false);
```

to:

```ts
  const strongItems = TECHNIQUE_CRITERIA.filter((c) => normalizeTechniqueRating(a.technique[c.key]) === "good");
  const mediumItems = TECHNIQUE_CRITERIA.filter((c) => normalizeTechniqueRating(a.technique[c.key]) === "medium");
  const weakItems   = TECHNIQUE_CRITERIA.filter((c) => normalizeTechniqueRating(a.technique[c.key]) === "bad");
```

- [ ] **Step 6: Include `mediumItems` in the score bar's total**

Change:

```ts
            {(strongItems.length + weakItems.length) > 0 && (
              <View style={[s.scoreBar, { marginTop: 10 }]}>
                <Text style={s.scoreLabel}>ציון טכניקה</Text>
                <Text style={s.scoreValue}>
                  {strongItems.length} / {strongItems.length + weakItems.length}
                </Text>
              </View>
            )}
```

to:

```ts
            {(strongItems.length + mediumItems.length + weakItems.length) > 0 && (
              <View style={[s.scoreBar, { marginTop: 10 }]}>
                <Text style={s.scoreLabel}>ציון טכניקה</Text>
                <Text style={s.scoreValue}>
                  {strongItems.length} / {strongItems.length + mediumItems.length + weakItems.length}
                </Text>
              </View>
            )}
```

This is a deliberate small correction beyond the spec's literal "leave the
score bar unchanged" wording: the *meaning* (good count / total rated count)
stays exactly the same, but the total must now include medium-rated
criteria too — otherwise a criterion marked "medium" would silently vanish
from the denominator entirely, which would be a regression, not "unchanged".
The numerator (`strongItems.length`) is untouched, so medium ratings still
get no partial credit, matching the spec's explicit scope.

- [ ] **Step 7: Insert the "בינוני" section between the existing two**

Change:

```ts
            {weakItems.length > 0 && (
              <>
                <Text style={[s.sectionHeader, s.sectionHeaderRed, { marginTop: 4 }]}>
                  נדרש שיפור ({weakItems.length})
                </Text>
```

to:

```ts
            {mediumItems.length > 0 && (
              <>
                <Text style={[s.sectionHeader, s.sectionHeaderAmber, { marginTop: 4 }]}>
                  בינוני ({mediumItems.length})
                </Text>
                <View style={s.techTable}>
                  {mediumItems.map((c, i) => (
                    <View
                      key={c.key}
                      style={[s.techRow, s.techRowAmber, i === mediumItems.length - 1 ? { borderBottomWidth: 0 } : {}]}
                    >
                      <Text style={s.techLabel}>{c.label}</Text>
                      <Text style={[s.techMark, s.markAmber]}>○</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {weakItems.length > 0 && (
              <>
                <Text style={[s.sectionHeader, s.sectionHeaderRed, { marginTop: 4 }]}>
                  נדרש שיפור ({weakItems.length})
                </Text>
```

(This finds the exact text right before the existing `weakItems.length > 0`
block and inserts a new, complete `mediumItems.length > 0` block immediately
before it — the rest of the `weakItems` block below is untouched.)

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project — this was the last file with
pending errors from Task 1's type change.

- [ ] **Step 9: Commit**

```bash
git add src/components/assessment-pdf.tsx
git commit -m "feat(assessments): add medium rating section to the PDF export"
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
files).

- [ ] **Step 3: Manual end-to-end verification**

Once deployed, as a coach or admin:

1. Go to a new assessment report form. Confirm every technique row now
   shows three buttons (✓ green, ○ amber, ✗ red), and confirm clicking a
   button toggles it on/off (clicking the same one again clears it, exactly
   like the existing two-button behavior did).
2. Rate a few criteria: some good, some medium, some bad, leave a couple
   unrated. Confirm the summary counter at the top of the technique section
   shows three separate live-updating numbers.
3. Save the report. Open its detail view — confirm the header badge shows
   three counts, and each row shows the correct colored icon (green check /
   amber circle / red X / gray dash for unrated).
4. Generate/download the PDF for that report (via the existing send/export
   action) — confirm it now has three sections ("חוזקות", "בינוני",
   "נדרש שיפור") each listing the right criteria, and that "ציון טכניקה" at
   the top shows `<good count> / <good+medium+bad count>`.
5. **Critical backward-compatibility check:** open an assessment report
   that was created *before* this change (only has good/bad ratings, no
   medium). Confirm its detail view and PDF still render exactly as they
   did before — correct counts, no crashes, no criteria mysteriously
   missing or mis-colored.

- [ ] **Step 4: Report results to the user**

Summarize pass/fail for each check in Step 3 before considering the task
done.

---

## Plan Self-Review Notes

- **Spec coverage:** the `TechniqueRating` type + `normalizeTechniqueRating`
  helper (Task 1), the re-export path used by the PDF file (Task 2), server
  validation (Task 3), and all three UI surfaces — form (Task 4), detail
  view (Task 5), PDF (Task 6) — are each implemented exactly per
  `docs/superpowers/specs/2026-08-28-assessment-medium-rating-design.md`.
  Backward compatibility with old boolean-only saved reports is explicitly
  verified in Task 7 Step 3.5, not just asserted.
- **No placeholders:** every step has complete, exact code.
- **Type consistency:** `TechniqueRating = "good" | "medium" | "bad"` is
  defined once (Task 1) and used identically — same three literal strings,
  same casing — in the form's `setTech` calls (Task 4), the detail view's
  comparisons (Task 5), and the PDF's `normalizeTechniqueRating(...) ===`
  comparisons (Task 6). `normalizeTechniqueRating` has one definition (Task
  1) and is imported (never redefined) everywhere it's used (Tasks 5–6).
