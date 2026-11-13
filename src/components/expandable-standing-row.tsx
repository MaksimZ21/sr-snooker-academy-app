"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

// A standings row that opens a detail line underneath when tapped. Kept in
// its own client file so the standings table itself stays hook-free and can
// still render on the server (public league page).
export function ExpandableStandingRow({
  className,
  colSpan,
  detail,
  children,
}: {
  className?: string;
  colSpan: number;
  detail: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={cn(className, "cursor-pointer hover:bg-muted/40", open && "bg-muted/40")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {children}
      </tr>
      {open && (
        <tr className="border-b border-border/20 bg-muted/20">
          <td colSpan={colSpan} className="px-3 md:px-4 py-2 whitespace-normal">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
