import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchStudentTournamentHistory } from "@/lib/sheets/student-tournaments";
import { fetchStudentLeagueHistory } from "@/lib/sheets/student-leagues";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StudentTournamentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const [entries, leagueEntries] = await Promise.all([
    fetchStudentTournamentHistory(student.id),
    fetchStudentLeagueHistory(student.id),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">הטורנירים שלי</h1>
      <p className="text-muted-foreground mb-1">דירוג נוכחי</p>
      <p className="text-3xl font-bold mb-6">{student.rating}</p>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בטורניר</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <Card key={entry.tournamentId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{entry.tournamentName}</p>
                  {entry.placement && <Badge>{entry.placement}</Badge>}
                </div>
                {entry.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">טרם שוחקו משחקים</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {entry.matches.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">נגד {m.opponentName}</span>
                        <span className={m.won ? "text-primary font-medium" : "text-muted-foreground"}>
                          {m.framesFor}-{m.framesAgainst} {m.won ? "ניצחון" : "הפסד"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-xl font-bold mt-10 mb-4">הליגות שלי</h2>
      {leagueEntries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בליגה</p>
      ) : (
        <div className="flex flex-col gap-4">
          {leagueEntries.map((entry) => (
            <Card key={entry.leagueId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.leagueName}</p>
                    {entry.districtLabel && <p className="text-xs text-muted-foreground">{entry.districtLabel}</p>}
                  </div>
                  {entry.placement && <Badge>{entry.placement}</Badge>}
                </div>
                {!entry.districtLabel ? (
                  <p className="text-sm text-muted-foreground">עדיין לא שובצת למחוז</p>
                ) : entry.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">טרם שוחקו משחקים</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {entry.matches.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">נגד {m.opponentName}</span>
                        <span className={m.won ? "text-primary font-medium" : "text-muted-foreground"}>
                          {m.framesFor}-{m.framesAgainst} {m.won ? "ניצחון" : "הפסד"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
