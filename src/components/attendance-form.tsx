import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late" | "confirmed" | "declined";

const DOT: Record<string, string> = {
  present: "bg-emerald-500",
  late: "bg-amber-400",
  absent: "bg-red-500",
  declined: "bg-red-300",
  confirmed: "bg-sky-400",
};

// A student's attendance like a team's form guide: the percentage as a
// scoreboard number, the counts, and the last sessions as colored dots
// (newest on the right, the reading start).
export function AttendanceForm({
  present,
  absent,
  total,
  recent,
}: {
  present: number;
  absent: number;
  total: number;
  // Newest first.
  recent?: { id: string; status: Status; label: string }[];
}) {
  const pct = total > 0 ? Math.round((present / total) * 100) : null;
  const tone = pct === null ? "text-muted-foreground" : pct >= 75 ? "text-primary" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive";
  return (
    <section className="rounded-[18px] border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-[13px] font-bold text-muted-foreground">נוכחות</p>
          <p className={cn("bc-num text-5xl leading-none mt-1.5", tone)}>{pct === null ? "—" : `${pct}%`}</p>
        </div>
        <div className="flex gap-5 text-center">
          <div>
            <p className="bc-num text-2xl leading-none">{present}</p>
            <p className="text-xs text-muted-foreground mt-1">הגיע</p>
          </div>
          <div>
            <p className="bc-num text-2xl leading-none text-destructive">{absent}</p>
            <p className="text-xs text-muted-foreground mt-1">לא הגיע</p>
          </div>
          <div>
            <p className="bc-num text-2xl leading-none text-muted-foreground">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">אימונים</p>
          </div>
        </div>
      </div>
      {recent && recent.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">אימונים אחרונים</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <span
                key={r.id}
                title={r.label}
                className={cn("w-4 h-4 rounded-full shadow-[inset_-2px_-2px_3px_rgb(0_0_0/0.25)]", DOT[r.status] ?? "bg-muted")}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
