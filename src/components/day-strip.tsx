"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { dayLabelHe, todayIsoTel } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

export type DayColumnItem = { day: string; count: number; content: React.ReactNode };

// The schedule as day columns side by side: swiped sideways on a phone, all
// visible in a grid on a wider screen (no scrolling). Opens scrolled to today or the next day with matches.
// `content` may be server-rendered JSX (the public league page).
export function DayColumns({ items }: { items: DayColumnItem[] }) {
  const today = todayIsoTel();
  const startDay = items.find((i) => i.day >= today)?.day ?? items[items.length - 1]?.day;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef(new Map<string, HTMLDivElement>());

  // Put the start day at the right edge (RTL start). Only the row scrolls,
  // never the page. Waits until the row is visible (on the public page it
  // may start inside a hidden tab).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const col = startDay ? colRefs.current.get(startDay) : undefined;
    if (!scroller || !col) return;
    let done = false;
    const align = () => {
      if (done || scroller.clientWidth === 0 || scroller.scrollWidth <= scroller.clientWidth) return;
      done = true;
      scroller.scrollBy({ left: col.getBoundingClientRect().right - scroller.getBoundingClientRect().right });
    };
    align();
    if (done) return;
    const ro = new ResizeObserver(align);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [startDay]);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible"
      >
        {items.map((item) => (
          <div
            key={item.day}
            ref={(el) => {
              if (el) colRefs.current.set(item.day, el);
              else colRefs.current.delete(item.day);
            }}
            className={cn(
              "snap-start shrink-0 w-[85%] md:w-auto rounded-xl border bg-card flex flex-col",
              item.day === today ? "border-primary" : "border-border/60",
            )}
          >
            <div
              className={cn(
                "flex items-baseline justify-between gap-2 px-3 py-2 border-b border-border/40 rounded-t-xl",
                item.day === today ? "bg-primary/10" : "bg-muted/40",
              )}
            >
              <p className="text-sm font-semibold">
                {dayLabelHe(item.day)} · {shortDate(item.day)}
                {item.day === today && <span className="text-xs font-medium text-primary"> (היום)</span>}
              </p>
              <span className="text-[11px] text-muted-foreground shrink-0">{item.count} משחקים</span>
            </div>
            <div className="px-3 py-2">{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
