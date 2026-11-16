import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchSessionsForStudent } from "@/lib/sheets/sessions";
import { TYPE_COLORS } from "@/components/broadcast";

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

  const [next, ...later] = upcoming;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto flex flex-col gap-5">
      <div className="bc-slide">
        <p className="bc-kicker text-[13px] text-primary">האזור שלי</p>
        <h1 className="bc-num text-[32px] md:text-[40px] leading-[1.05] mt-1.5">שלום, {student.first_name}</h1>
      </div>

      {!next ? (
        <div className="rounded-[18px] border border-dashed bg-card py-12 text-center text-muted-foreground">
          אין אימונים מתוכננים כרגע
        </div>
      ) : (
        <>
          {/* The next session leads, like the coach's home */}
          <div className="relative overflow-hidden rounded-[18px] p-5 text-white bg-brand-gradient bc-slide">
            <p className="font-display text-[13px] font-bold text-white/75">האימון הבא</p>
            <p className="font-display text-lg font-extrabold mt-1">{formatDate(next.date)}</p>
            <p className="bc-num text-6xl leading-none mt-2">{next.start_time}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold">
                {TYPE_LABELS[next.training_type] ?? next.training_type}
              </span>
              {next.end_time && (
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold tabular-nums">עד {next.end_time}</span>
              )}
              {next.address && (
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-display text-xs font-bold">{next.address}</span>
              )}
            </div>
          </div>

          {later.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-base font-extrabold">בהמשך</h2>
              <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
                {later.map((s) => (
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
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
