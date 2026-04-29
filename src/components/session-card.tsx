import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/sheets/schemas";
import { formatHebrewDate } from "@/lib/date";

const TYPE_LABEL: Record<string, string> = {
  private: "פרטני",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

export function SessionCard({
  session,
  basePath,
}: {
  session: Session;
  basePath: "coach" | "admin";
}) {
  return (
    <Link href={`/${basePath}/sessions/${session.id}`}>
      <Card className="hover:bg-accent/40 transition">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div className="font-medium">
              {session.start_time}–{session.end_time}
            </div>
            <Badge variant={session.status === "cancelled" ? "secondary" : "default"}>
              {TYPE_LABEL[session.training_type] ?? session.training_type}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">{formatHebrewDate(session.date)}</div>
          <div className="text-sm">{session.student_ids.length} מתאמנים</div>
        </CardContent>
      </Card>
    </Link>
  );
}
