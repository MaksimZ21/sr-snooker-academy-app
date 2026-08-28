# Assessment Technique — "Medium" Rating — Design Spec

Date: 2026-08-28

## Purpose

Assessment reports (דוחות אבחון) currently rate each technique criterion as
binary — good (✓) or not good (✗). This adds a third, middle rating so a
coach can mark a criterion as "medium/okay" instead of being forced into one
of the two extremes.

## Scope

- Applies to the `technique` field only (the per-criterion V/X grid) —
  nothing else about assessments changes.
- No database migration needed: `technique` is stored as a flexible JSON
  value (no dedicated schema/migration file for the `assessments` table
  exists in this repo, matching several other tables), so adding a third
  possible value per key is purely an application-layer change.
- Existing saved reports (which only ever have `true`/`false` per
  criterion) must keep rendering correctly and unchanged in every existing
  view — old data is not touched or migrated, only reinterpreted at read
  time.

## Data Model

`src/lib/sheets/assessment-types.ts`:

```ts
export type TechniqueRating = "good" | "medium" | "bad";
export type Technique = Partial<Record<TechniqueKey, TechniqueRating>>;
```

New reports are always saved with the three string values above — `true`/
`false` are never written again after this change.

### Backward compatibility with existing data

A single shared helper normalizes a raw stored value (which may still be a
legacy `boolean` for old reports, or one of the new strings for new ones)
into a `TechniqueRating | undefined`:

```ts
export function normalizeTechniqueRating(
  raw: boolean | TechniqueRating | undefined,
): TechniqueRating | undefined {
  if (raw === true) return "good";
  if (raw === false) return "bad";
  return raw;
}
```

Every place that reads a `technique[key]` value for display or counting
(form pre-fill when an assessment is later viewed, detail view, PDF) runs it
through this helper first. Every place that *writes* a value only ever
writes `"good" | "medium" | "bad"`. This is the only compatibility shim
needed — old reports have no `"medium"` entries by construction, so they
display exactly as they always have (good/bad), and nothing about them
needs to change in storage.

## Server-Side Validation

`src/app/api/assessments/route.ts`'s `TechniqueSchema` currently is
`z.record(z.string(), z.boolean())`. Changes to:

```ts
const TechniqueSchema = z.record(z.string(), z.enum(["good", "medium", "bad"]));
```

## UI Changes

### Compose form (`src/components/assessment-form.tsx`)

- Each criterion row gains a third button between the existing ✓ (green)
  and ✗ (red): a `○` (Circle icon), amber-colored, setting that criterion
  to `"medium"`.
- The summary counter at the top of the technique section (currently
  `{passCount}/{ratedCount} ✓`) becomes three counts — good, medium, bad —
  e.g. `✓ 8　○ 2　✗ 1`.

### Detail view (`src/components/assessment-detail-view.tsx`)

- Each row's icon: green `CheckCircle2` for good, amber `Circle` for
  medium, red `XCircle` for bad, gray `Minus` for unrated (unchanged for
  the unrated case).
- The header summary badge (currently `{passCount}/{ratedCount} עברו`)
  becomes a three-part summary, e.g. `8 טוב · 2 בינוני · 1 לא טוב`.

### PDF (`src/components/assessment-pdf.tsx`)

- A third section, "בינוני (N)", inserted between the existing "חוזקות (N)"
  and "נדרש שיפור (N)" sections — same visual treatment (a labeled table of
  rows with a colored mark), amber instead of green/red, `○` instead of
  ✓/✗.
- "ציון טכניקה" (the score bar at the top) is **unchanged** — it continues
  to show `good count / total rated count`, the same meaning it has today.
  Explicitly not recalculated to account for medium ratings (e.g. as a
  partial credit) — out of scope per product decision.

## Out of Scope (YAGNI)

- No recalculation of the PDF's top-line "ציון טכניקה" score to give medium
  ratings partial credit — it stays a plain good/total count, unchanged in
  meaning.
- No bulk-editing or backfilling of existing saved reports — they keep
  showing only good/bad as they always have; nobody goes back and marks
  anything "medium" retroactively.
- No change to how many rating states exist beyond three — no further
  granularity (e.g. a 5-point scale) was requested.
