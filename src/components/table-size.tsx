"use client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TABLE_SIZES, TABLE_SIZE_LABEL, type TableSize } from "@/lib/sheets/schemas";

// Which table a tournament or league is played on (9-10 ft or 12 ft).
export function TableSizeSelect({
  value,
  onChange,
  disabled,
}: {
  value: TableSize | null;
  onChange: (v: TableSize | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => v && onChange(v === "none" ? null : (v as TableSize))}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">לא נבחר</SelectItem>
        {TABLE_SIZES.map((s) => (
          <SelectItem key={s} value={s}>{TABLE_SIZE_LABEL[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TableSizeBadge({ size }: { size: TableSize | null }) {
  if (!size) return null;
  return (
    <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5 shrink-0">
      {TABLE_SIZE_LABEL[size]}
    </Badge>
  );
}
