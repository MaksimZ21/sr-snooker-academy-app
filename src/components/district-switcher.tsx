"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

// One button per district; only the selected district's content is shown.
// `content` may be server-rendered JSX (the public league page passes it
// straight from a server component).
export function DistrictSwitcher({
  items,
}: {
  items: { id: string; label: string; content: React.ReactNode }[];
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  if (items.length === 0) return null;
  if (items.length === 1) return <>{items[0].content}</>;

  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            aria-pressed={item.id === selected.id}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              item.id === selected.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected.content}
    </div>
  );
}
