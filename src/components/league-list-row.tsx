import Link from "next/link";
import { ChevronLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type ListLeague = {
  id: string;
  name: string;
  completed: boolean;
  table_size?: string | null;
  participant_count?: number;
  district_count?: number;
};

// One league in a list: name, table, districts and players at a glance.
export function LeagueListRow({ league: l, href }: { league: ListLeague; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3.5 px-4 py-3 hover:bg-muted/40 transition-colors">
      <span
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bc-slant",
          l.completed ? "bg-muted text-muted-foreground" : "bg-sidebar text-[#7ee2a4]",
        )}
      >
        <Shield size={18} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[15px] font-semibold truncate group-hover:text-primary transition-colors">{l.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {l.table_size && (
            <span className="rounded-md bg-muted text-muted-foreground px-2 py-0.5 font-display text-[11px] font-bold">
              {l.table_size === "12" ? "12 פיט" : "9-10 פיט"}
            </span>
          )}
          {typeof l.district_count === "number" && l.district_count > 0 && (
            <span className="rounded-md bg-muted text-muted-foreground px-2 py-0.5 font-display text-[11px] font-bold">
              {l.district_count} מחוזות
            </span>
          )}
        </div>
      </div>
      {typeof l.participant_count === "number" && (
        <div className="text-center shrink-0">
          <p className="bc-num text-2xl leading-none">{l.participant_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">שחקנים</p>
        </div>
      )}
      <ChevronLeft size={16} className="text-muted-foreground/40 shrink-0" />
    </Link>
  );
}
