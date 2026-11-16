import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchStudentTournamentHistory } from "@/lib/sheets/student-tournaments";
import { fetchStudentLeagueHistory } from "@/lib/sheets/student-leagues";
import { Card, CardContent } from "@/components/ui/card";
import { TableSizeBadge } from "@/components/table-size";

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
      <h1 className="bc-num text-[28px] md:text-[36px] leading-[1.05] mb-1">הטורנירים שלי</h1>
      <p className="text-muted-foreground mb-3">הדרגה שלי</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          ["12 פיט", student.skill_level],
          ["9-10 פיט", student.skill_level_9ft],
        ].map(([label, level]) => (
          <div key={label} className="rounded-[18px] bg-sidebar text-white px-4 py-3.5 bc-slide">
            <p className="font-display text-xs font-bold text-white/60">{label}</p>
            <p className="bc-num text-5xl leading-none mt-1.5 text-[#7ee2a4]" dir="ltr">{level ?? "—"}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בטורניר</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <Card key={entry.tournamentId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium">{entry.tournamentName}</p>
                    <TableSizeBadge size={entry.tableSize} />
                  </div>
                  {entry.placement && (
                    <span className="rounded-lg bg-sidebar text-white px-2.5 py-1 font-display text-xs font-extrabold shrink-0">{entry.placement}</span>
                  )}
                </div>
                {entry.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">טרם שוחקו משחקים</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {entry.matches.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-display text-xs font-extrabold text-white shrink-0 ${m.won ? "bg-primary" : "bg-red-500"}`}
                        >
                          {m.won ? "נ" : "ה"}
                        </span>
                        <span className="flex-1 min-w-0 truncate">נגד {m.opponentName}</span>
                        <span className="bc-num text-lg leading-none" dir="ltr">
                          {m.framesFor}-{m.framesAgainst}
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

      <h2 className="bc-num text-2xl mt-10 mb-4">הליגות שלי</h2>
      {leagueEntries.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין לא השתתפת בליגה</p>
      ) : (
        <div className="flex flex-col gap-4">
          {leagueEntries.map((entry) => (
            <Card key={entry.leagueId}>
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{entry.leagueName}</p>
                      <TableSizeBadge size={entry.tableSize} />
                    </div>
                    {entry.districtLabel && <p className="text-xs text-muted-foreground">{entry.districtLabel}</p>}
                  </div>
                  {entry.placement && (
                    <span className="rounded-lg bg-sidebar text-white px-2.5 py-1 font-display text-xs font-extrabold shrink-0">{entry.placement}</span>
                  )}
                </div>
                {!entry.districtLabel ? (
                  <p className="text-sm text-muted-foreground">עדיין לא שובצת למחוז</p>
                ) : entry.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">טרם שוחקו משחקים</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {entry.matches.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-display text-xs font-extrabold text-white shrink-0 ${m.won ? "bg-primary" : "bg-red-500"}`}
                        >
                          {m.won ? "נ" : "ה"}
                        </span>
                        <span className="flex-1 min-w-0 truncate">נגד {m.opponentName}</span>
                        <span className="bc-num text-lg leading-none" dir="ltr">
                          {m.framesFor}-{m.framesAgainst}
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
