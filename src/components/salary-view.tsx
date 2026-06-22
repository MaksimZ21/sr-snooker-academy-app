"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Banknote, ChevronDown, ChevronUp } from "lucide-react";
import type { SalaryResponse, CoachSalary } from "@/app/api/admin/salary/route";

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2026, i, 1);
  return {
    value: `2026-${String(i + 1).padStart(2, "0")}`,
    label: d.toLocaleDateString("he-IL", { month: "long", year: "numeric" }),
  };
}).reverse();

const SOURCE_COLOR: Record<string, string> = {
  "מכללה": "bg-blue-100 text-blue-700 border-blue-200",
  "אירוע הכרות": "bg-amber-100 text-amber-700 border-amber-200",
};

function CoachRow({ coach, nameMap }: { coach: CoachSalary; nameMap: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const name = nameMap[coach.email] ?? coach.email;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-right"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-semibold text-sm">{name}</span>
          <span className="text-xs text-muted-foreground">{coach.sessions_total} אימונים</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-base tabular-nums">
            {coach.amount_total.toLocaleString("he-IL")} ₪
          </span>
          {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {coach.rows.map((row) => (
            <div key={row.source} className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${SOURCE_COLOR[row.source] ?? "bg-muted text-muted-foreground"}`}
                >
                  {row.source}
                </Badge>
                <span className="text-sm text-muted-foreground">{row.count} אימונים</span>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {row.total_nis.toLocaleString("he-IL")} ₪
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SalaryView() {
  const currentMonth = `2026-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);

  const { data, isLoading } = useQuery({
    queryKey: ["salary", month],
    queryFn: async () => {
      const r = await fetch(`/api/admin/salary?month=${month}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as SalaryResponse;
    },
    staleTime: 30_000,
  });

  const { data: coachesData } = useQuery({
    queryKey: ["coaches:all"],
    queryFn: async () => {
      const r = await fetch("/api/coaches");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { coaches: { email: string; name: string }[] };
    },
    staleTime: 300_000,
  });

  const nameMap: Record<string, string> = {};
  for (const c of coachesData?.coaches ?? []) nameMap[c.email] = c.name;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Month picker */}
      <select
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>

      {/* Summary */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Banknote size={16} className="text-primary" />
              סה"כ לתשלום
            </div>
            <span className="text-xl font-bold tabular-nums text-primary">
              {(data?.grand_total ?? 0).toLocaleString("he-IL")} ₪
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {(data?.coaches ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">אין נתונים לחודש זה</p>
            ) : (
              (data?.coaches ?? []).map((coach) => (
                <CoachRow key={coach.email} coach={coach} nameMap={nameMap} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
