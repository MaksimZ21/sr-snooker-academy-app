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
              "snap-start shrink-0 w-[85%] md:w-auto rounded-[18px] border bg-card flex flex-col overflow-hidden",
              item.day === today ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2.5",
                item.day === today ? "bg-primary text-white" : "bg-sidebar text-white",
              )}
            >
              <p className="flex items-baseline gap-2">
                <span className="font-display text-sm font-extrabold">{dayLabelHe(item.day)}</span>
                <span className="bc-num text-base text-white/75">{shortDate(item.day)}</span>
                {item.day === today && <span className="rounded-md bg-white/20 px-1.5 py-0.5 font-display text-[11px] font-bold">היום</span>}
              </p>
              <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-display text-[11px] font-bold shrink-0">{item.count} משחקים</span>
            </div>
            <div className="p-2.5">{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
