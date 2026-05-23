import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";
import { fetchSessionsAll } from "@/lib/sheets/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/sheets/schemas";

const TYPE_LABELS: Record<string, string> = {
  private: "אישי",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function StudentHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const [attendance, allSessions] = await Promise.all([
    fetchAttendanceForStudent(student.id),
    fetchSessionsAll(),
  ]);

  const presentIds = new Set(
    attendance.filter((a) => a.status === "present").map((a) => a.session_id),
  );
  const sessionMap = new Map<string, Session>(allSessions.map((s) => [s.id, s]));

  const history = [...presentIds]
    .map((id) => sessionMap.get(id))
    .filter((s): s is Session => s !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">היסטוריית אימונים</h1>
      <p className="text-muted-foreground mb-6">אימונים שנכחת בהם</p>

      {history.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין היסטוריית אימונים עדיין</p>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{formatDate(s.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.start_time} – {s.end_time}
                  </p>
                </div>
                <Badge variant="secondary">{TYPE_LABELS[s.training_type] ?? s.training_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
