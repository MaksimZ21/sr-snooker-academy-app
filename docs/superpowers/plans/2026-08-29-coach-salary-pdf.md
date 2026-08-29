# Coach Monthly Salary PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin, from `/admin/salary` in month view, generate a PDF salary report for one coach's selected month and send it straight to that coach's WhatsApp number, in one click.

**Architecture:** A new single-coach/single-month data function (`fetchCoachSalaryForMonth`) reuses the existing `CoachSalary`/`SessionDetail`/`OffsetEntry` types already defined in the salary route. A new `@react-pdf/renderer` document component mirrors the existing assessment PDF's styling. A new admin-only API route renders the PDF to a buffer and sends it via the Green API upload function already used elsewhere in the app. The `SalaryView` UI gets one new button, visible only in month mode.

**Tech Stack:** Next.js API routes, Supabase (`db` service-role client), `@react-pdf/renderer`, Green API (WhatsApp), zod, TanStack Query (implicit — button uses local state, no new query), sonner toasts, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-29-coach-salary-pdf-design.md`

---

### Task 1: Add `start_time` to the salary route's session data

**Files:**
- Modify: `src/app/api/admin/salary/route.ts`

- [ ] **Step 1: Extend the `SessionDetail` type**

Change:

```ts
export type SessionDetail = {
  id: string;
  date: string;
  source: string;
  training_type: string;
  price_nis: number;
};
```

to:

```ts
export type SessionDetail = {
  id: string;
  date: string;
  start_time: string;
  source: string;
  training_type: string;
  price_nis: number;
};
```

- [ ] **Step 2: Select `start_time` in the sessions query**

Change:

```ts
    let sessionQuery = db
      .from("sessions")
      .select("id, coach_email, source, price_nis, training_type, date")
      .neq("status", "cancelled")
      .neq("coach_email", "");
```

to:

```ts
    let sessionQuery = db
      .from("sessions")
      .select("id, coach_email, source, price_nis, training_type, date, start_time")
      .neq("status", "cancelled")
      .neq("coach_email", "");
```

- [ ] **Step 3: Populate `start_time` when building each `SessionDetail`**

Change:

```ts
      // Per coach session detail
      if (!sessionsPerCoach.has(email)) sessionsPerCoach.set(email, []);
      sessionsPerCoach.get(email)!.push({
        id: row.id as string,
        date: row.date as string,
        source,
        training_type: type,
        price_nis: price,
      });
```

to:

```ts
      // Per coach session detail
      if (!sessionsPerCoach.has(email)) sessionsPerCoach.set(email, []);
      sessionsPerCoach.get(email)!.push({
        id: row.id as string,
        date: row.date as string,
        start_time: (row.start_time as string) ?? "",
        source,
        training_type: type,
        price_nis: price,
      });
```

This is purely additive — every existing consumer of `SessionDetail` (the CSV export, `SessionsByDate`/`SessionRow` in `salary-view.tsx`) keeps working unchanged; they simply don't read the new field yet.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/salary/route.ts
git commit -m "feat: include session start_time in salary API response"
```

---

### Task 2: Single-coach monthly salary data function

**Files:**
- Create: `src/lib/sheets/salary.ts`

- [ ] **Step 1: Write the file**

```ts
import { db } from "@/lib/db/client";
import type { CoachSalary, SessionDetail, OffsetEntry } from "@/app/api/admin/salary/route";

// Single-coach, single-month version of the aggregation the admin salary
// dashboard does across all coaches at once (src/app/api/admin/salary/route.ts).
// Reuses that route's types (type-only import — no runtime dependency) so
// there is exactly one definition of what a "coach salary" shape looks
// like. Returns null for a malformed month string; returns a CoachSalary
// with empty arrays/zero totals (never null) when the month is valid but
// the coach simply has no sessions/offsets that month.
export async function fetchCoachSalaryForMonth(
  email: string,
  month: string, // "YYYY-MM"
): Promise<CoachSalary | null> {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [{ data: sessionRows }, { data: coachRow }] = await Promise.all([
    db
      .from("sessions")
      .select("id, source, price_nis, training_type, date, start_time")
      .eq("coach_email", email)
      .neq("status", "cancelled")
      .gte("date", start)
      .lt("date", nextMonth),
    db.from("coaches").select("offsets").eq("email", email).maybeSingle(),
  ]);

  const sessions: SessionDetail[] = (sessionRows ?? [])
    .map((row) => ({
      id: row.id as string,
      date: row.date as string,
      start_time: (row.start_time as string) ?? "",
      source: (row.source as string) || "אחר",
      training_type: (row.training_type as string) || "אחר",
      price_nis: (row.price_nis as number) ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  const bySource = new Map<string, { count: number; total: number }>();
  for (const s of sessions) {
    if (!bySource.has(s.source)) bySource.set(s.source, { count: 0, total: 0 });
    const agg = bySource.get(s.source)!;
    agg.count++;
    agg.total += s.price_nis;
  }
  const rows = Array.from(bySource.entries()).map(([source, agg]) => ({
    source,
    count: agg.count,
    total_nis: agg.total,
  }));

  const amount_total = sessions.reduce((s, r) => s + r.price_nis, 0);
  const allOffsets = (coachRow?.offsets ?? []) as OffsetEntry[];
  const offsets = allOffsets.filter((o) => o.month === month);
  const offsets_total = offsets.reduce((s, o) => s + o.amount, 0);

  return {
    email,
    rows,
    sessions,
    sessions_total: sessions.length,
    amount_total,
    offsets,
    offsets_total,
    net_total: amount_total - offsets_total,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets/salary.ts
git commit -m "feat: add fetchCoachSalaryForMonth for single-coach salary PDFs"
```

---

### Task 3: PDF document component

**Files:**
- Create: `src/components/salary-pdf.tsx`

- [ ] **Step 1: Write the file**

```tsx
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import path from "path";
import type { CoachSalary } from "@/app/api/admin/salary/route";

Font.register({
  family: "Heebo",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Bold.ttf"), fontWeight: 700 },
  ],
});

const GREEN = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const ROSE = "#cc2222";
const BORDER = "#d0e8db";

const s = StyleSheet.create({
  page: { fontFamily: "Heebo", backgroundColor: "#fff", padding: 28, fontSize: 10 },

  header: { alignItems: "center", marginBottom: 10 },
  academyName: { fontSize: 8, color: "#888", marginBottom: 3, textAlign: "center" },
  title: { fontSize: 15, fontWeight: 700, color: GREEN, textAlign: "center" },
  subtitle: { fontSize: 9, color: "#666", marginTop: 3, textAlign: "center" },

  divider: { height: 1.5, backgroundColor: GREEN, marginBottom: 14, borderRadius: 1 },

  sectionHeader: {
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    textAlign: "right",
    backgroundColor: GREEN,
  },

  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: LIGHT_GREEN,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colDate: { width: 60, textAlign: "right", color: "#333" },
  colTime: { width: 40, textAlign: "right", color: "#333" },
  colType: { flex: 1, textAlign: "right", color: "#333" },
  colPrice: { width: 60, textAlign: "left", color: GREEN, fontWeight: 700 },
  headerCell: { fontWeight: 700, color: "#555" },

  offsetRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  offsetDesc: { flex: 1, textAlign: "right", color: "#333" },
  offsetAmount: { color: ROSE, fontWeight: 700 },

  totalsBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fafffe",
  },
  totalsRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#555" },
  totalsValue: { fontWeight: 700, color: "#333" },
  netRow: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4, paddingTop: 6 },
  netValue: { fontWeight: 700, color: GREEN, fontSize: 12 },

  footer: {
    marginTop: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: "#aaa" },
});

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function SalaryPdfDocument({
  coach,
  coachName,
  period,
}: {
  coach: CoachSalary;
  coachName: string;
  period: string;
}) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.academyName}>SHACHAR RUBERG SNOOKER ACADEMY</Text>
          <Text style={s.title}>{coachName} – דוח שכר</Text>
          <Text style={s.subtitle}>תקופה: {period}</Text>
        </View>

        <View style={s.divider} />

        <Text style={s.sectionHeader}>אימונים ({coach.sessions.length})</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.colDate, s.headerCell]}>תאריך</Text>
            <Text style={[s.colTime, s.headerCell]}>שעה</Text>
            <Text style={[s.colType, s.headerCell]}>סוג אימון</Text>
            <Text style={[s.colPrice, s.headerCell]}>סכום</Text>
          </View>
          {coach.sessions.map((sess, i) => (
            <View
              key={sess.id}
              style={[s.tableRow, i === coach.sessions.length - 1 ? { borderBottomWidth: 0 } : {}]}
            >
              <Text style={s.colDate}>{formatDate(sess.date)}</Text>
              <Text style={s.colTime}>{sess.start_time || "—"}</Text>
              <Text style={s.colType}>{sess.training_type}</Text>
              <Text style={s.colPrice}>{sess.price_nis.toLocaleString("he-IL")} ₪</Text>
            </View>
          ))}
        </View>

        {coach.offsets.length > 0 && (
          <>
            <Text style={s.sectionHeader}>קיזוזים ({coach.offsets.length})</Text>
            <View style={s.table}>
              {coach.offsets.map((o, i) => (
                <View
                  key={o.id}
                  style={[s.offsetRow, i === coach.offsets.length - 1 ? { borderBottomWidth: 0 } : {}]}
                >
                  <Text style={s.offsetDesc}>{o.description}</Text>
                  <Text style={s.offsetAmount}>-{o.amount.toLocaleString("he-IL")} ₪</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={s.totalsBox}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>סה״כ אימונים</Text>
            <Text style={s.totalsValue}>{coach.sessions_total}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>הכנסה גולמית</Text>
            <Text style={s.totalsValue}>{coach.amount_total.toLocaleString("he-IL")} ₪</Text>
          </View>
          {coach.offsets_total > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>קיזוזים</Text>
              <Text style={[s.totalsValue, { color: ROSE }]}>
                -{coach.offsets_total.toLocaleString("he-IL")} ₪
              </Text>
            </View>
          )}
          <View style={[s.totalsRow, s.netRow]}>
            <Text style={s.totalsLabel}>לתשלום</Text>
            <Text style={s.netValue}>{coach.net_total.toLocaleString("he-IL")} ₪</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Shachar Ruberg Snooker Academy</Text>
          <Text style={s.footerText}>נוצר ב-{new Date().toLocaleDateString("he-IL")}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/salary-pdf.tsx
git commit -m "feat: add SalaryPdfDocument PDF template"
```

---

### Task 4: Generate-and-send API route

**Files:**
- Create: `src/app/api/admin/salary/[email]/send-pdf/route.tsx`

- [ ] **Step 1: Write the file**

```tsx
import React from "react";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";
import { fetchCoachSalaryForMonth } from "@/lib/sheets/salary";
import { sendWhatsAppFileByUpload } from "@/lib/whatsapp/greenapi";
import { SalaryPdfDocument } from "@/components/salary-pdf";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const Body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const { email } = await params;
    const { month } = Body.parse(await req.json());

    const { data: coachRow } = await db
      .from("coaches")
      .select("name, phone")
      .eq("email", email)
      .maybeSingle();
    if (!coachRow) {
      return NextResponse.json({ error: "מאמן לא נמצא" }, { status: 404 });
    }
    const coachName = (coachRow.name as string) || email;
    const phone = coachRow.phone as string;
    if (!phone) {
      return NextResponse.json({ error: "לא מוגדר מספר טלפון למאמן" }, { status: 400 });
    }

    const salary = await fetchCoachSalaryForMonth(email, month);
    if (!salary || salary.sessions.length === 0) {
      return NextResponse.json({ error: "אין אימונים לחודש זה" }, { status: 400 });
    }

    const label = monthLabel(month);
    const buffer = await renderToBuffer(
      <SalaryPdfDocument coach={salary} coachName={coachName} period={label} />,
    );
    await sendWhatsAppFileByUpload(
      phone,
      buffer,
      `דוח שכר - ${coachName} - ${label}.pdf`,
      "application/pdf",
      `📊 דוח שכר – ${label}`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/salary/[email]/send-pdf/route.tsx"
git commit -m "feat: add admin route to generate and send a coach's salary PDF"
```

---

### Task 5: Wire the button into `SalaryView`

**Files:**
- Modify: `src/components/salary-view.tsx`

- [ ] **Step 1: Add the two new icons to the lucide-react import**

Change:

```ts
import {
  Banknote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, CalendarDays, Users, Download, Minus, Plus, Trash2,
} from "lucide-react";
```

to:

```ts
import {
  Banknote, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, CalendarDays, Users, Download, Minus, Plus, Trash2,
  FileText, Loader2,
} from "lucide-react";
```

- [ ] **Step 2: Add the `SendSalaryPdfButton` component**

Add this new function right after the `OffsetsSection` function (i.e. right before the `/* ── Coach card ── */` comment):

```tsx
/* ── Send PDF button ──────────────────────────────────────────── */

function SendSalaryPdfButton({ email, month }: { email: string; month: string }) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const toastId = toast.loading("שולח PDF...");
    try {
      const r = await fetch(`/api/admin/salary/${encodeURIComponent(email)}/send-pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "שגיאה בשליחת ה-PDF");
      }
      toast.success("ה-PDF נשלח למאמן", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשליחת ה-PDF", { id: toastId });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border/40 px-4 py-3 flex justify-end">
      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={sending} onClick={send}>
        {sending ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
        {sending ? "שולח..." : "הפקת ושליחת PDF למאמן"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Give `CoachRow` a `monthMode` prop and render the button**

Change the `CoachRow` signature:

```tsx
function CoachRow({ coach, nameMap, rank, queryKey, currentMonth }: {
  coach: CoachSalary;
  nameMap: Record<string, string>;
  rank: number;
  queryKey: unknown[];
  currentMonth: string;
}) {
```

to:

```tsx
function CoachRow({ coach, nameMap, rank, queryKey, currentMonth, monthMode }: {
  coach: CoachSalary;
  nameMap: Record<string, string>;
  rank: number;
  queryKey: unknown[];
  currentMonth: string;
  monthMode: boolean;
}) {
```

Then change:

```tsx
          {/* Offsets */}
          <OffsetsSection coach={coach} queryKey={queryKey} currentMonth={currentMonth} />
        </div>
      )}
    </div>
  );
}
```

to:

```tsx
          {/* Offsets */}
          <OffsetsSection coach={coach} queryKey={queryKey} currentMonth={currentMonth} />

          {/* Send PDF */}
          {monthMode && <SendSalaryPdfButton email={coach.email} month={currentMonth} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pass `monthMode` from `SalaryView`**

Change:

```tsx
          {sorted.map((coach, i) => (
            <CoachRow
              key={coach.email}
              coach={coach}
              nameMap={nameMap}
              rank={i + 1}
              queryKey={["salary", mode, year, month]}
              currentMonth={mode === "month" ? `${year}-${String(month).padStart(2, "0")}` : `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
            />
          ))}
```

to:

```tsx
          {sorted.map((coach, i) => (
            <CoachRow
              key={coach.email}
              coach={coach}
              nameMap={nameMap}
              rank={i + 1}
              queryKey={["salary", mode, year, month]}
              currentMonth={mode === "month" ? `${year}-${String(month).padStart(2, "0")}` : `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
              monthMode={mode === "month"}
            />
          ))}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/salary-view.tsx
git commit -m "feat: add per-coach send-salary-PDF button to admin salary page"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 2: Full test run**

Run: `npm run test:run`
Expected: all existing tests still pass. No new test files are added by this
feature — every new function here either queries the `db` service-role
client or renders a PDF/calls the live Green API, matching the existing
untested pattern for this class of function (e.g. `assessment-pdf.tsx`,
`src/app/api/admin/salary/route.ts` have no test files today either).

- [ ] **Step 3: Manual sanity check**

In the running app (`npm run dev`), open `/admin/salary`, switch to "חודש"
mode, pick a month where a coach has sessions, expand that coach's row, and
click "הפקת ושליחת PDF למאמן". Confirm:
- A loading toast appears, followed by a success toast.
- The coach receives a WhatsApp PDF file with the correct sessions, offsets
  (if any), and totals matching what's shown on screen for that coach/month.
- The PDF text renders correctly in Hebrew (not garbled/boxes) — confirms
  the Heebo font registration works the same way it already does for
  assessment PDFs.

Then test the two error paths:
- Pick a coach/month combination with zero sessions — confirm an error
  toast ("אין אימונים לחודש זה") and no message is sent.
- If a coach with no phone number is available for testing, confirm the
  "לא מוגדר מספר טלפון למאמן" error toast appears.

Finally, switch to "שנה" or "כל הזמן" mode and confirm the send-PDF button
does not appear at all.

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Report to the user (in Hebrew)**

Summarize what shipped: בעמוד ניהול השכר, בתצוגת חודש, אפשר עכשיו להפיק
ולשלוח לכל מאמן PDF עם האימונים, הקיזוזים והסיכום הכספי שלו לאותו חודש,
ישירות לוואטסאפ שלו.
