"use client";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Small "delete result" link used beside a played match.
export function ClearResultButton({
  onClear,
  disabled,
  className,
}: {
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (window.confirm("למחוק את התוצאה של המשחק?")) onClear();
      }}
      className={cn(
        "inline-flex items-center gap-0.5 font-display text-xs font-bold text-muted-foreground hover:text-destructive disabled:opacity-50",
        className,
      )}
      title="מחק תוצאה"
    >
      <Trash2 size={12} />
      מחק תוצאה
    </button>
  );
}
