import { cn } from "@/lib/utils";

// ISPA logo + Israel flag as two equal-height white tiles, used on
// multi-location (national) tournaments.
export function IspaBrand({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  const tile = cn(
    "bg-white overflow-hidden shrink-0 ring-1 ring-black/10 shadow-[0_6px_16px_-10px_rgb(13_21_16/0.45)]",
    size === "lg" ? "h-20 rounded-2xl" : "h-11 rounded-xl",
  );
  return (
    <div className={cn("flex items-center", size === "lg" ? "gap-3" : "gap-2", className)}>
      <div className={cn(tile, size === "lg" ? "px-3 py-1.5" : "px-1.5 py-1")}>
        <img src="/ispa-logo.png" alt="ISPA" className="h-full w-auto object-contain" />
      </div>
      <div className={tile}>
        <img src="/israel-flag.svg" alt="׳“׳’׳ ׳™׳©׳¨׳׳" className="h-full w-auto" />
      </div>
    </div>
  );
}
