import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/sheets/schemas";

// The "broadcast" look shared by the admin and coach home pages: a live
// ticker, ball tiles, the week's bars and today's rows.

// Snooker ball color per training type.
export const TYPE_COLORS: Record<string, string> = {
  private: "#c0392b",
  group: "#2980b9",
  beginners: "#d4a017",
  advanced: "#e91e8c",
  technique: "#78716c",
  "match-play": "#1a7a4a",
};

// Current time in Israel as "HH:MM", for "now" / "next" against session times.
export function nowHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date());
}

// The red "on the table today" strip that runs across the top, like a sports channel.
export function LiveTicker({
  items,
  isLoading,
  label = "היום על השולחן",
  empty = "אין מפגשים היום",
}: {
  items: { id: string; time: string; text: string }[];
  isLoading: boolean;
  label?: string;
  empty?: string;
}) {
  const row = (copy: string) =>
    items.map((x) => (
      <span key={`${x.id}${copy}`} className="text-sm whitespace-nowrap">
        <b className="font-display font-bold text-[#7ee2a4] me-2 tabular-nums">{x.time}</b>
        {x.text}
      </span>
    ));
  return (
    <div className="bc-ticker bg-sidebar text-white flex items-stretch h-11 overflow-hidden">
      <span className="relative z-10 bg-[#d61f2c] font-display font-extrabold text-sm flex items-center gap-2 ps-[18px] pe-[26px] shrink-0 [clip-path:polygon(0_0,100%_0,100%_100%,12px_100%)]">
        <i className="w-2 h-2 rounded-full bg-white bc-blink" />
        {label}
      </span>
      {isLoading ? null : items.length === 0 ? (
        <span className="flex items-center ps-6 text-sm text-white/60">{empty}</span>
      ) : (
        <div className="bc-track flex items-center gap-10 ps-6">
          {row("")}
          {/* A second copy, so the strip loops without a gap. */}
          {row("-again")}
        </div>
      )}
    </div>
  );
}

export function BallTile({
  label, value, sub, href, ball, isLoading, delay,
}: {
  label: string;
  value?: number;
  sub?: string;
  href?: string;
  ball: "red" | "yellow" | "green" | "blue" | "pink" | "black";
  isLoading: boolean;
  delay: number;
}) {
  const Tag = href ? Link : "div";
  return (
    <Tag
      href={href ?? ""}
      className={cn(
        "bc-ball bc-slide block bg-card border rounded-[18px] p-[18px] min-h-36 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-18px_rgb(13_21_16/0.35)]",
        `bc-ball-${ball}`,
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <p className="font-display font-bold text-[13px] text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-12 w-16 mt-2.5" />
      ) : (
        <p className="bc-num text-[56px] leading-none mt-2.5">{value ?? 0}</p>
      )}
      {sub && <p className="text-[13px] text-muted-foreground mt-1">{sub}</p>}
    </Tag>
  );
}

export function WeekBars({ days, today }: { days: { date: string; day: string; count: number }[]; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex items-end gap-2.5 h-44 px-[18px] pt-8 pb-3">
      {days.map((d, i) => (
        <div key={d.date} className="flex-1 h-full flex flex-col items-center justify-end gap-2">
          <div
            className={cn("w-full rounded-md relative bc-grow", d.date === today ? "bc-bar-today" : "bg-muted dark:bg-white/10")}
            style={{ height: `${Math.max(3, (d.count / max) * 88)}%`, animationDelay: `${0.3 + i * 0.06}s` }}
          >
            {d.count > 0 && (
              <span className="absolute -top-5 inset-x-0 text-center font-display font-extrabold text-[13px] text-muted-foreground">{d.count}</span>
            )}
          </div>
          <span className={cn("font-display font-bold text-xs", d.date === today ? "text-primary" : "text-muted-foreground")}>{d.day}</span>
        </div>
      ))}
    </div>
  );
}

// This week's sessions by type: one stacked bar in ball colors, with a legend.
export function TypeSplit({ slices }: { slices: { type: string; label: string; count: number }[] }) {
  const total = slices.reduce((n, x) => n + x.count, 0) || 1;
  return (
    <div className="px-[18px] pb-4 flex flex-col gap-2">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
        {slices.map((x) => (
          <span key={x.type} style={{ width: `${(x.count / total) * 100}%`, background: TYPE_COLORS[x.type] ?? "#94a3b8" }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {slices.map((x) => (
          <span key={x.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <i className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[x.type] ?? "#94a3b8" }} />
            {x.label}
            <b className="font-display text-foreground tabular-nums">{x.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

// A row of a day's list: ball-colored stripe, slanted time, who and a pill.
export function BroadcastRow({
  session,
  href,
  who,
  sub,
  now,
}: {
  session: Session;
  href: string;
  who: string;
  sub: string;
  // "HH:MM" today, or null when the row isn't today's.
  now: string | null;
}) {
  const { label } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";
  const isNow = !cancelled && now !== null && session.start_time <= now && now < session.end_time;
  return (
    <Link
      href={href}
      className={cn(
        "grid grid-cols-[6px_72px_1fr_auto] items-center gap-3.5 px-[18px] py-3 border-b last:border-b-0 transition-colors",
        isNow ? "bg-primary/8" : "hover:bg-muted/50",
      )}
    >
      <span className="self-stretch rounded-md" style={{ background: cancelled ? "#94a3b8" : (TYPE_COLORS[session.training_type] ?? "#94a3b8") }} />
      <div className={cn(cancelled && "opacity-40 line-through")}>
        <p className="bc-num text-[22px] leading-none">{session.start_time}</p>
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">עד {session.end_time}</p>
      </div>
      <div className="min-w-0">
        <p className="font-bold text-[15px] truncate">{who}</p>
        <p className="text-[13px] text-muted-foreground truncate">{sub}</p>
      </div>
      <span
        className={cn(
          "font-display font-bold text-xs px-2.5 py-1 rounded-lg",
          cancelled ? "bg-destructive/10 text-destructive" : isNow ? "bg-[#d61f2c] text-white" : "bg-muted text-muted-foreground",
        )}
      >
        {cancelled ? "לא התקיים" : isNow ? "עכשיו" : label}
      </span>
    </Link>
  );
}
