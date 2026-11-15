import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tournament } from "@/lib/sheets/tournaments";

function Chip({ children, tone }: { children: React.ReactNode; tone?: "warn" | "dark" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 font-display text-[11px] font-bold",
        tone === "warn" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : tone === "dark" ? "bg-sidebar text-white" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

// One tournament in a list: the name with what matters at a glance — date,
// table, type, how many signed up, and anything that needs attention.
// The list API returns full rows; pages may type only part of them.
type ListTournament = Pick<Tournament, "id" | "name" | "manager_email" | "completed"> &
  Partial<Pick<Tournament, "event_date" | "table_size" | "type" | "registration_closed">> & { participant_count?: number };

export function TournamentListRow({ tournament: t, href }: { tournament: ListTournament; href: string }) {
  const date = t.event_date ? `${t.event_date.slice(8, 10)}.${t.event_date.slice(5, 7)}` : null;
  return (
    <Link href={href} className="group flex items-center gap-3.5 px-4 py-3 hover:bg-muted/40 transition-colors">
      <span
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bc-slant",
          t.completed ? "bg-muted text-muted-foreground" : "bg-sidebar text-amber-400",
        )}
      >
        <Trophy size={18} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[15px] font-semibold truncate group-hover:text-primary transition-colors">{t.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {date && <Chip tone="dark">{date}</Chip>}
          {t.table_size && <Chip>{t.table_size === "12" ? "12 פיט" : "9-10 פיט"}</Chip>}
          {t.type === "multi_location" && <Chip>רב-מיקומי</Chip>}
          {t.registration_closed && !t.completed && <Chip>הרשמה סגורה</Chip>}
          {t.type !== "multi_location" && !t.manager_email && <Chip tone="warn">ללא מאמן אחראי</Chip>}
        </div>
      </div>
      {typeof t.participant_count === "number" && (
        <div className="text-center shrink-0">
          <p className="bc-num text-2xl leading-none">{t.participant_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">משתתפים</p>
        </div>
      )}
      <ChevronLeft size={16} className="text-muted-foreground/40 shrink-0" />
    </Link>
  );
}
