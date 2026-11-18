import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ClipboardList, MessageSquare, Target, Trophy, NotebookPen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchSessionsForStudent } from "@/lib/sheets/sessions";
import { fetchAttendanceForStudent } from "@/lib/sheets/attendance";
import { fetchStudentVisibleNotes } from "@/lib/sheets/notes";
import { fetchStudentGoals } from "@/lib/sheets/monthly-goals";
import { GOAL_CATEGORIES, currentMonth } from "@/lib/sheets/monthly-goals-shared";
import { fetchStudentTournamentHistory } from "@/lib/sheets/student-tournaments";
import { fetchStudentLeagueHistory } from "@/lib/sheets/student-leagues";
import { fetchAssessmentsForStudent } from "@/lib/sheets/assessments";
import { TYPE_COLORS } from "@/components/broadcast";
import { todayIsoTel } from "@/lib/date";

const TYPE_LABELS: Record<string, string> = {
  private: "אישי",
  group: "קבוצתי",
  beginners: "מתחילים",
  advanced: "מתקדמים",
  technique: "טכניקה",
  "match-play": "משחק",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h2 className="font-display text-base font-extrabold">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 font-display text-xs font-bold text-muted-foreground hover:text-foreground">
          {linkLabel ?? "הכל"}
          <ChevronLeft size={14} />
        </Link>
      )}
    </div>
  );
}

export default async function StudentDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const [sessions, attendance, notes, goals, tournaments, leagues, assessments] = await Promise.all([
    fetchSessionsForStudent(student.id),
    fetchAttendanceForStudent(student.id),
    fetchStudentVisibleNotes(student.id),
    fetchStudentGoals(student.id),
    fetchStudentTournamentHistory(student.id),
    fetchStudentLeagueHistory(student.id),
    fetchAssessmentsForStudent(student),
  ]);

  const today = todayIsoTel();
  const month = currentMonth();
  const upcoming = sessions.filter((s) => s.date >= today && s.status !== "cancelled");
  const [next, ...later] = upcoming;

  // Attendance
  const sessionDate = new Map(sessions.map((s) => [s.id, s.date]));
  const attended = attendance.filter((a) => a.status === "present" || a.status === "late");
  const attendedThisMonth = attended.filter((a) => (sessionDate.get(a.session_id) ?? "").startsWith(month)).length;

  // Monthly goal
  const goalNow = goals.find((g) => g.goal.month === month);
  const goalLabel = goalNow ? (GOAL_CATEGORIES.find((c) => c.key === goalNow.goal.category)?.label ?? goalNow.goal.category) : null;
  const isBreaks = goalNow?.goal.category === "breaks";
  const goalPoints = (goalNow?.entries ?? [])
    .map((e) =>
      isBreaks
        ? e.best_break
        : e.success_count !== null && e.attempt_count ? Math.round((e.success_count / e.attempt_count) * 100) : null,
    )
    .filter((v): v is number => v !== null);
  const goalLatest = goalPoints.at(-1) ?? null;
  const goalBest = goalPoints.length ? Math.max(...goalPoints) : null;

  // Competition record
  const allMatches = [...tournaments.flatMap((t) => t.matches), ...leagues.flatMap((l) => l.matches)];
  const wins = allMatches.filter((m) => m.won).length;
  const losses = allMatches.length - wins;
  const competitions = [
    ...tournaments.map((t) => ({ key: `t:${t.tournamentId}`, name: t.tournamentName, placement: t.placement, last: t.matches.at(-1) ?? null, kind: "טורניר" })),
    ...leagues.map((l) => ({ key: `l:${l.leagueId}`, name: l.leagueName, placement: l.placement, last: l.matches.at(-1) ?? null, kind: "ליגה" })),
  ].slice(0, 3);

  const lastNote = notes[0] ?? null;
  const noteIsNew = lastNote ? Date.now() - new Date(lastNote.created_at).getTime() < 7 * 24 * 3600 * 1000 : false;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto flex flex-col gap-6">
      {/* Greeting + levels */}
      <div className="rounded-[22px] bg-sidebar text-white p-5 md:p-6 bc-slide">
        <p className="bc-kicker text-[13px] text-[#7ee2a4]">האזור שלי</p>
        <h1 className="bc-num text-[32px] md:text-[40px] leading-[1.05] mt-1.5">שלום, {student.first_name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-5">
          {[
            { label: "דרגה 12 פיט", value: student.skill_level ?? "—", accent: true },
            { label: "דרגה 9-10 פיט", value: student.skill_level_9ft ?? "—", accent: true },
            { label: "אימונים החודש", value: String(attendedThisMonth), accent: false },
            { label: "ניצחונות-הפסדים", value: allMatches.length ? `${wins}-${losses}` : "—", accent: false },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl bg-white/8 px-3.5 py-3">
              <p className="font-display text-[11px] font-bold text-white/55">{t.label}</p>
              <p className={`bc-num text-3xl leading-none mt-1.5 ${t.accent ? "text-[#7ee2a4]" : ""}`} dir="ltr">
                {t.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Next session */}
      <section>
        <SectionTitle title="האימון הבא" />
        {!next ? (
          <div className="rounded-[18px] border border-dashed bg-card py-10 text-center text-muted-foreground">
            אין אימונים מתוכננים כרגע
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-[18px] p-5 text-white bg-brand-gradient">
              <p className="font-display text-lg font-extrabold">{formatDate(next.date)}</p>
              <p className="bc-num text-6xl leading-none mt-2">{next.start_time}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold">
                  {TYPE_LABELS[next.training_type] ?? next.training_type}
                </span>
                {next.end_time && (
                  <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold tabular-nums">עד {next.end_time}</span>
                )}
                {next.address && <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold">{next.address}</span>}
              </div>
            </div>
            {later.length > 0 && (
              <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
                {later.slice(0, 3).map((s) => (
                  <div key={s.id} className="grid grid-cols-[6px_64px_1fr_auto] items-center gap-3.5 px-4 py-3">
                    <span className="self-stretch rounded-md" style={{ background: TYPE_COLORS[s.training_type] ?? "#94a3b8" }} />
                    <span className="bc-num text-xl leading-none">{s.start_time}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] truncate">{formatDate(s.date)}</p>
                      {s.address && <p className="text-xs text-muted-foreground truncate">{s.address}</p>}
                    </div>
                    <span className="rounded-md bg-muted px-2 py-0.5 font-display text-xs font-bold text-muted-foreground">
                      {TYPE_LABELS[s.training_type] ?? s.training_type}
                    </span>
                  </div>
                ))}
                {later.length > 3 && (
                  <p className="px-4 py-2.5 text-xs text-muted-foreground">ועוד {later.length - 3} אימונים</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly goal */}
        <section>
          <SectionTitle title="המטרה של החודש" href="/student/goal" linkLabel="לפרטים" />
          <Link href="/student/goal" className="block rounded-[18px] border bg-card p-4 hover:bg-muted/40 transition-colors h-[calc(100%-2rem)]">
            {goalNow ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Target size={18} />
                  </span>
                  <p className="font-display text-lg font-extrabold">{goalLabel}</p>
                </div>
                {goalPoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-3">המאמן ירשום את התוצאה הראשונה באימון הקרוב</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">אחרון</p>
                      <p className="bc-num text-2xl leading-none mt-1" dir="ltr">{goalLatest}{isBreaks ? "" : "%"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">הכי טוב</p>
                      <p className="bc-num text-2xl leading-none mt-1 text-primary" dir="ltr">{goalBest}{isBreaks ? "" : "%"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">מדידות</p>
                      <p className="bc-num text-2xl leading-none mt-1">{goalPoints.length}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Target size={18} />
                <p className="text-sm">עדיין לא נבחרה מטרה לחודש הזה</p>
              </div>
            )}
          </Link>
        </section>

        {/* Last coach note */}
        <section>
          <SectionTitle title="מהמאמן" href="/student/history" linkLabel="כל הסיכומים" />
          <div className="rounded-[18px] border bg-card p-4 h-[calc(100%-2rem)]">
            {lastNote ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <NotebookPen size={15} className="text-primary" />
                  <p className="text-xs text-muted-foreground">{formatShortDate(lastNote.created_at)}</p>
                  {noteIsNew && (
                    <span className="rounded-md bg-primary text-primary-foreground px-1.5 py-0.5 font-display text-[10px] font-extrabold">חדש</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap">{lastNote.text}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">עדיין אין סיכומים מהמאמן</p>
            )}
          </div>
        </section>
      </div>

      {/* Competitions */}
      {competitions.length > 0 && (
        <section>
          <SectionTitle title="תחרויות" href="/student/tournaments" />
          <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
            {competitions.map((c) => (
              <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                <Trophy size={16} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.kind}
                    {c.last && ` · אחרון: ${c.last.won ? "ניצחון" : "הפסד"} ${c.last.framesFor}-${c.last.framesAgainst} נגד ${c.last.opponentName}`}
                  </p>
                </div>
                {c.placement && (
                  <span className="rounded-lg bg-sidebar text-white px-2.5 py-1 font-display text-xs font-extrabold shrink-0">{c.placement}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="grid grid-cols-2 gap-2.5">
        {assessments.length > 0 && (
          <Link href="/student/assessments" className="flex items-center gap-2.5 rounded-[18px] border bg-card px-4 py-3.5 hover:bg-muted/40 transition-colors">
            <ClipboardList size={18} className="text-primary" />
            <span className="font-display text-sm font-bold">דוח האבחון שלי</span>
          </Link>
        )}
        <Link href="/student/contact" className="flex items-center gap-2.5 rounded-[18px] border bg-card px-4 py-3.5 hover:bg-muted/40 transition-colors">
          <MessageSquare size={18} className="text-primary" />
          <span className="font-display text-sm font-bold">פנייה לאדמין</span>
        </Link>
      </section>
    </div>
  );
}
