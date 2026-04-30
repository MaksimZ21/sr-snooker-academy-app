import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card className="hover:bg-accent/40 hover:shadow-md transition overflow-hidden">
        <CardContent className="p-3 flex gap-3">
          <div className={cn("w-1 self-stretch rounded-full shrink-0", stripe)} />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex justify-between items-start gap-2">
              <div
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  cancelled && "opacity-60 line-through",
                )}
              >
                {session.start_time}–{session.end_time}
              </div>
              <Badge className={cn("border", className)} variant="outline">
                {label}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatHebrewDate(session.date)}
            </div>
            <div className="text-sm">{session.student_ids.length} מתאמנים</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
