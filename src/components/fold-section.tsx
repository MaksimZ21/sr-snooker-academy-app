"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function readStored(key: string): boolean | null {
  try {
    const v = localStorage.getItem(key);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

// A section that can be folded away to cut down scrolling. The choice is
// remembered on this device (per `storageKey`).
export function FoldSection({
  title,
  storageKey,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = readStored(`fold:${storageKey}`);
    if (stored !== null) setOpen(stored);
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      try {
        localStorage.setItem(`fold:${storageKey}`, prev ? "0" : "1");
      } catch {}
      return !prev;
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center justify-between gap-2 rounded-xl px-1 py-1 text-sm font-semibold hover:text-primary"
      >
        <span>{title}</span>
        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
          {open ? "הסתר" : "הצג"}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && children}
    </section>
  );
}
