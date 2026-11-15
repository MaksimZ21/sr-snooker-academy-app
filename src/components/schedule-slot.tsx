import Link from "next/link";
import { cn } from "@/lib/utils";

// One slot in the weekly schedule (a session, a tournament, an intro event).
// Same anatomy for all of them so a day column reads at a glance: a colored
// stripe, the time as a scoreboard number, one title line, one meta line.
export function ScheduleSlot({
  href,
  color,
  start,
  end,
  kind,
  title,
  meta,
  status,
  cancelled = false,
}: {
  href: string;
  // The stripe and the kind dot (a snooker ball color per training type).
  color: string;
  start?: string;
  end?: string | null;
  // Small label on the top row: training type, "טורניר", "אירוע היכרות".
  kind: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  cancelled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] duration-150",
        "hover:border-foreground/20 hover:shadow-[0_8px_20px_-14px_rgb(13_21_16/0.4)]",
        cancelled && "opacity-60",
      )}
    >
      <span className="w-1.5 shrink-0" style={{ background: cancelled ? "#94a3b8" : color }} />
      <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          {start ? (
            <p className={cn("leading-none", cancelled && "line-through")}>
              <span className="bc-num text-[19px]">{start}</span>
              {end && <span className="text-xs text-muted-foreground tabular-nums"> – {end}</span>}
            </p>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5 font-display text-[11px] font-bold text-muted-foreground shrink-0">
            <i className="w-2 h-2 rounded-full" style={{ background: color }} />
            {kind}
          </span>
        </div>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2">{title}</p>
        {(meta || status) && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2 min-w-0 flex-wrap">{meta}</span>
            {status}
          </div>
        )}
      </div>
    </Link>
  );
}

// Group names often end with their day and time ("… - ימי שני 18:30"),
// which the slot already shows; drop that tail so the title stays short.
export function shortSlotTitle(name: string): string {
  return name.replace(/\s*[-–]\s*(?:ימי|יום)\s+\S+\s+\d{1,2}:\d{2}\s*$/, "").trim() || name;
}
