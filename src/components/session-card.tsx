import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ChevronLeft } from "lucide-react";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";

const STRIPE: Record<string, string> = {
  private: "bg-blue-400",
  group: "bg-emerald-400",
  beginners: "bg-amber-400",
  advanced: "bg-violet-400",
  technique: "bg-orange-400",
  "match-play": "bg-rose-400",
};

export function SessionCard({
  session,
  basePath,
}: {
  session: Session;
  basePath: "coach" | "admin";
}) {
  const { label, className } = trainingTypeBadge(session.training_type);
  const stripe = STRIPE[session.training_type] ?? "bg-muted-foreground/40";
  const cancelled = session.status === "cancelled";

  return (
    <Link href={`/${basePath}/sessions/${session.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-border/60">
        <CardContent className="p-0 flex">
          <div className={cn("w-1.5 self-stretch shrink-0", stripe, cancelled && "opacity-40")} />
          <div className="flex-1 px-3.5 py-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div
                className={cn(
                  "tabular-nums leading-tight",
                  cancelled && "opacity-40 line-through",
                )}
              >
                <span className="text-base font-bold">{session.start_time}</span>
                <span className="text-sm font-normal text-muted-foreground"> – {session.end_time}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge className={cn("border text-xs", className)} variant="outline">
                  {label}
                </Badge>
                {cancelled && (
                  <Badge variant="destructive" className="text-xs">בוטל</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{formatHebrewDate(session.date)}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-primary transition-colors duration-200">
                <span className="flex items-center gap-0.5">
                  <Users size={11} />
                  {session.student_ids.length}
                </span>
                <ChevronLeft size={12} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
