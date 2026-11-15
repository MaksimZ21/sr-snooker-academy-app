import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchSessionsForStudent } from "@/lib/sheets/sessions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  });
}

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const today = new Date().toISOString().slice(0, 10);
  const allSessions = await fetchSessionsForStudent(student.id);
  const upcoming = allSessions.filter((s) => s.date >= today && s.status !== "cancelled");

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">שלום, {student.first_name}</h1>
      <p className="text-muted-foreground mb-6">האימונים הקרובים שלך</p>

      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">אין אימונים מתוכננים כרגע</p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{formatDate(s.date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.start_time} – {s.end_time}
                    {s.address ? ` · ${s.address}` : ""}
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
