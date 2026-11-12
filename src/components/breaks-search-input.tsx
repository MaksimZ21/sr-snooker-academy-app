"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function BreaksSearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative px-4 pb-2">
      <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-6 -mt-1 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="חיפוש לפי שם"
        className="h-8 ps-8 text-sm"
        type="search"
      />
    </div>
  );
}
