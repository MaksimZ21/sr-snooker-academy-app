import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";

const STRIPE: Record<string, string> = {
  private: "bg-blue-400",
  group: "bg-emerald-400",
  beginners: "bg-amber-400",
  advanced: "bg-purple-400",
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
      <Card className="hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden cursor-pointer">
        <CardContent className="p-0 flex">
          <div className={cn("w-1.5 self-stretch shrink-0", stripe)} />
          <div className="flex-1 p-3 flex flex-col gap-1.5">
            <div className="flex justify-between items-start gap-2">
              <div
                className={cn(
                  "text-lg font-semibold tabular-nums leading-tight",
                  cancelled && "opacity-50 line-through",
                )}
              >
                {session.start_time}–{session.end_time}
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
            <div className="text-xs text-muted-foreground">
              {formatHebrewDate(session.date)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users size={12} />
              <span>{session.student_ids.length} מתאמנים</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
