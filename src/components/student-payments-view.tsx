"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Check, CircleHelp, Copy, Loader2, Pencil, Search, Send, Snowflake, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/motion/count-up";
import { StudentPaymentDialog } from "@/components/student-payment-dialog";
import { PaidOnDialog } from "@/components/paid-on-dialog";
import { cn } from "@/lib/utils";
import { todayIsoTel, weekRangeFor } from "@/lib/date";
import { buildPaymentsSummaryText, paymentStatus, summarizePayments, type PaymentStatus } from "@/lib/sheets/payments-logic";
import type { PaymentBoardRow, PaymentGroup } from "@/lib/sheets/payments";
import type { PaymentBoardResponse } from "@/app/api/admin/payments/route";

const QUERY_KEY = ["payments:board"];

const STATUS_STYLE: Record<PaymentStatus, { label: string; pill: string; dot: string }> = {
  overdue: { label: "באיחור", pill: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300", dot: "bg-rose-500" },
  due_week: { label: "לתשלום השבוע", pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", dot: "bg-amber-500" },
  paid: { label: "משולם", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300", dot: "bg-emerald-500" },
  missing: { label: "חסרים פרטים", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
  frozen: { label: "מוקפא", pill: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300", dot: "bg-sky-400" },
};

// Within a group: who needs attention first.
const STATUS_ORDER: PaymentStatus[] = ["overdue", "due_week", "missing", "paid", "frozen"];

type Filter = "all" | PaymentStatus;

const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const nis = (n: number) => `₪${n.toLocaleString("he-IL")}`;

export function StudentPaymentsView() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery<PaymentBoardResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/admin/payments");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [college, setCollege] = useState<string>("all");
  const [groupId, setGroupId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PaymentBoardRow | null>(null);

  const today = todayIsoTel();
  const weekEnd = weekRangeFor(today).endIso;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const statusOf = (r: PaymentBoardRow) => paymentStatus(r, today, weekEnd);

  const colleges = useMemo(
    () => [...new Set(rows.map((r) => r.group?.college_name || r.college_name).filter(Boolean))].sort(),
    [rows],
  );
  const inCollege = rows.filter(
    (r) =>
      (college === "all" || (r.group?.college_name || r.college_name) === college) &&
      (groupId === "all" || (r.group?.id ?? "__none") === groupId),
  );
  // The groups to pick from, within the chosen branch.
  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (college !== "all" && (r.group?.college_name || r.college_name) !== college) continue;
      const g = r.group;
      seen.set(g?.id ?? "__none", g ? [g.name, g.college_name].filter(Boolean).join(" · ") : "ללא קבוצה");
    }
    return [...seen.entries()].sort((a, b) => (a[0] === "__none" ? 1 : b[0] === "__none" ? -1 : a[1].localeCompare(b[1], "he")));
  }, [rows, college]);
  const summary = summarizePayments(inCollege, today, weekEnd);

  const q = query.trim();
  const visible = inCollege.filter(
    (r) => (filter === "all" || statusOf(r) === filter) && (!q || `${r.first_name} ${r.last_name}`.includes(q)),
  );

  // Grouped like the old sheet: one block per group, students without a group last.
  const blocks = useMemo(() => {
    const byGroup = new Map<string, { group: PaymentGroup | null; rows: PaymentBoardRow[] }>();
    for (const r of visible) {
      const key = r.group?.id ?? "__none";
      if (!byGroup.has(key)) byGroup.set(key, { group: r.group, rows: [] });
      byGroup.get(key)!.rows.push(r);
    }
    const list = [...byGroup.values()];
    for (const b of list) {
      b.rows.sort(
        (a, z) =>
          STATUS_ORDER.indexOf(paymentStatus(a, today, weekEnd)) - STATUS_ORDER.indexOf(paymentStatus(z, today, weekEnd)) ||
          (a.next_payment_date ?? "").localeCompare(z.next_payment_date ?? ""),
      );
    }
    return list.sort((a, z) => {
      if (!a.group) return 1;
      if (!z.group) return -1;
      return a.group.college_name.localeCompare(z.group.college_name, "he") || a.group.name.localeCompare(z.group.name, "he");
    });
  }, [visible, today, weekEnd]);

  // The row whose "שולם" was pressed — asks for the payment date first.
  const [paying, setPaying] = useState<PaymentBoardRow | null>(null);
  const markPaid = useMutation({
    mutationFn: async ({ row, paidOn }: { row: PaymentBoardRow; paidOn: string }) => {
      const r = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: row.id, paid_on: paidOn }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { payment_id: string; first_training_date: string | null };
    },
    onSuccess: ({ payment_id, first_training_date }, { row, paidOn }) => {
      setPaying(null);
      toast.success(`נרשם תשלום של ${row.first_name} ב-${ddmm(paidOn)}`, {
        description: first_training_date ? `אימון ראשון: ${ddmm(first_training_date)}` : undefined,
        action: {
          label: "בטל",
          onClick: async () => {
            const r = await fetch(`/api/admin/payments/history/${payment_id}`, { method: "DELETE" });
            if (!r.ok) toast.error("שגיאה בביטול");
            qc.invalidateQueries({ queryKey: QUERY_KEY });
          },
        },
      });
    },
    onError: () => toast.error("שגיאה ברישום התשלום"),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // The weekly summary for the branch/group currently chosen.
  const summaryText = () => buildPaymentsSummaryText(inCollege, today, weekRangeFor(today).startIso, weekEnd);
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      toast.success("הסיכום הועתק — אפשר להדביק בוואטסאפ");
    } catch {
      toast.error("לא הצלחתי להעתיק");
    }
  };
  // WhatsApp opens with the text ready; you pick the group to send it to.
  const shareSummary = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(summaryText())}`, "_blank", "noopener");
  };

  const tiles: { key: Filter; label: string; value: number; money?: number; icon: React.ReactNode; className: string }[] = [
    {
      key: "overdue",
      label: "באיחור",
      value: summary.overdue.count,
      money: summary.overdue.amount,
      icon: <AlertTriangle size={18} />,
      className: "bg-linear-to-br from-rose-500 to-rose-700 text-white",
    },
    {
      key: "due_week",
      label: "לתשלום השבוע",
      value: summary.dueWeek.count,
      money: summary.dueWeek.amount,
      icon: <CalendarClock size={18} />,
      className: "bg-linear-to-br from-amber-400 to-amber-600 text-white",
    },
    {
      key: "all",
      label: "צפוי בחודש",
      value: summary.monthly,
      icon: <Wallet size={18} />,
      className: "bg-brand-gradient text-white",
    },
    {
      key: "missing",
      label: "חסרים פרטים",
      value: summary.missing,
      icon: <CircleHelp size={18} />,
      className: "bg-card border",
    },
  ];

  if (isError) {
    return <p className="py-16 text-center text-sm text-muted-foreground">לא ניתן לטעון את התשלומים כרגע</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary tiles — a press filters the list */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setFilter(filter === t.key ? "all" : t.key)}
            style={{ animationDelay: `${i * 0.07}s` }}
            className={cn(
              "bc-slide relative overflow-hidden rounded-[18px] p-4 text-right flex flex-col gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-18px_rgb(13_21_16/0.45)]",
              t.className,
              filter === t.key && t.key !== "all" && "ring-4 ring-foreground/15",
            )}
          >
            <span className={t.className.includes("text-white") ? "text-white/80" : "text-muted-foreground"}>{t.icon}</span>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <span className="bc-num text-4xl leading-none">
                <CountUp value={t.value} suffix={t.key === "all" ? " ₪" : ""} />
              </span>
            )}
            <span className="font-display text-[13px] font-bold leading-tight opacity-90">
              {t.label}
              {t.money !== undefined && t.money > 0 && !isLoading && <span className="font-normal"> · {nis(t.money)}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-60">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש מתאמן..." className="h-9 rounded-xl pr-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...STATUS_ORDER] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-bold transition-colors",
                filter === f ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "הכל" : STATUS_STYLE[f].label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 sm:ms-auto">
          <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={copySummary}>
            <Copy size={13} />
            העתק סיכום
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full bg-[#25D366] text-xs text-white hover:bg-[#1fb857]"
            onClick={shareSummary}
          >
            <Send size={13} />
            שלח בוואטסאפ
          </Button>
        </div>
        {colleges.length > 1 && (
          <select
            value={college}
            onChange={(e) => {
              setCollege(e.target.value);
              setGroupId("all");
            }}
            className="h-8 rounded-full border bg-background px-3 text-xs font-bold"
            aria-label="סניף"
          >
            <option value="all">כל הסניפים</option>
            {colleges.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {groupOptions.length > 1 && (
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-8 max-w-56 rounded-full border bg-background px-3 text-xs font-bold"
            aria-label="קבוצה"
          >
            <option value="all">כל הקבוצות</option>
            {groupOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-[18px]" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">אין מתאמנים להצגה</p>
      ) : (
        blocks.map(({ group, rows: groupRows }, bi) => {
          const total = groupRows.filter((r) => !r.payment_frozen).reduce((n, r) => n + (r.payment_amount ?? 0), 0);
          return (
            <section
              key={group?.id ?? "none"}
              style={{ animationDelay: `${Math.min(bi, 8) * 0.05}s` }}
              className="animate-fade-in-up overflow-hidden rounded-[18px] border bg-card"
            >
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-2.5">
                <h3 className="font-display text-[15px] font-extrabold">{group?.name ?? "ללא קבוצה"}</h3>
                {group && (
                  <span className="text-xs text-muted-foreground">
                    {[group.college_name, group.coach_name, group.start_time.slice(0, 5)].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="ms-auto bc-num text-base">{nis(total)}</span>
              </header>
              <div className="divide-y">
                {groupRows.map((r) => {
                  const status = statusOf(r);
                  const st = STATUS_STYLE[status];
                  const pending = markPaid.isPending && markPaid.variables?.row.id === r.id;
                  return (
                    <div key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", st.dot)} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[15px]">
                              {r.first_name} {r.last_name}
                            </span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", st.pill)}>
                              {status === "frozen" && <Snowflake size={10} className="inline me-1" />}
                              {st.label}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span>{r.payment_method || "אין צורת תשלום"}</span>
                            {r.payment_amount !== null && <span className="font-semibold text-foreground">{nis(r.payment_amount)}</span>}
                            <span>שולם {ddmm(r.last_payment_date)}</span>
                            {r.first_training_date && <span>אימון ראשון {ddmm(r.first_training_date)}</span>}
                            <span className={cn(status === "overdue" && "font-bold text-rose-600", status === "due_week" && "font-bold text-amber-600")}>
                              חידוש {ddmm(r.next_payment_date)}
                            </span>
                          </div>
                          {r.payment_notes && <p className="mt-1 text-xs text-muted-foreground/90">{r.payment_notes}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                        {status !== "frozen" && r.payment_method && (
                          <Button
                            size="sm"
                            onClick={() => setPaying(r)}
                            disabled={pending}
                            className={cn(
                              "h-8 px-3",
                              status === "paid" ? "bg-muted text-foreground hover:bg-muted/70" : "bg-primary text-white hover:bg-primary/85",
                            )}
                          >
                            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            שולם
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(r)} aria-label="עריכת פרטי תשלום">
                          <Pencil size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <PaidOnDialog
        row={paying}
        pending={markPaid.isPending}
        onClose={() => setPaying(null)}
        onConfirm={(paidOn) => paying && markPaid.mutate({ row: paying, paidOn })}
      />
      <StudentPaymentDialog row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
