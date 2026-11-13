"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dayLabelHe, todayIsoTel } from "@/lib/date";
import { shortDate } from "@/lib/sheets/league-schedule-parse";

export type DayStripItem = { day: string; count: number; content: React.ReactNode };

// Days in a row you swipe sideways; only the picked day's matches show.
// Opens on today, or the next day with matches, or the last one.
// `content` may be server-rendered JSX (the public league page).
export function DayStrip({ items }: { items: DayStripItem[] }) {
  const today = todayIsoTel();
  const initial =
    items.find((i) => i.day >= today)?.day ?? items[items.length - 1]?.day;
  const [picked, setPicked] = useState(initial);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  const selected = items.find((i) => i.day === picked) ?? items.find((i) => i.day === initial);
  const index = selected ? items.indexOf(selected) : -1;

  const stripRef = useRef<HTMLDivElement>(null);
  const selectedDay = selected?.day;
  // Center the picked chip inside the strip only (scrollIntoView would also
  // scroll the page).
  useEffect(() => {
    const strip = stripRef.current;
    const chip = selectedDay ? chipRefs.current.get(selectedDay) : undefined;
    if (!strip || !chip) return;
    const s = strip.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    strip.scrollBy({ left: c.left + c.width / 2 - (s.left + s.width / 2), behavior: "smooth" });
  }, [selectedDay]);

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={index <= 0}
          onClick={() => setPicked(items[index - 1].day)}
          aria-label="יום קודם"
        >
          <ChevronRight size={16} />
        </Button>
        <div ref={stripRef} className="flex-1 min-w-0 flex gap-2 overflow-x-auto snap-x pb-1 [scrollbar-width:thin]">
          {items.map((item) => {
            const active = item.day === selected.day;
            return (
              <button
                key={item.day}
                ref={(el) => {
                  if (el) chipRefs.current.set(item.day, el);
                  else chipRefs.current.delete(item.day);
                }}
                type="button"
                onClick={() => setPicked(item.day)}
                aria-pressed={active}
                className={cn(
                  "snap-center shrink-0 rounded-xl border px-3 py-1.5 flex flex-col items-center leading-tight transition-colors min-w-16",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
                  !active && item.day === today && "border-primary/60 text-foreground",
                )}
              >
                <span className="text-xs font-medium">{dayLabelHe(item.day).replace("יום ", "")}</span>
                <span className="text-sm font-semibold tabular-nums">{shortDate(item.day)}</span>
                <span className={cn("text-[10px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {item.count} משחקים
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={index >= items.length - 1}
          onClick={() => setPicked(items[index + 1].day)}
          aria-label="יום הבא"
        >
          <ChevronLeft size={16} />
        </Button>
      </div>
      {selected.content}
    </div>
  );
}
