import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchAssessmentsForStudent } from "@/lib/sheets/assessments";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export default async function StudentAssessmentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const assessments = await fetchAssessmentsForStudent(student);
  // One report is the usual case: open it straight away.
  if (assessments.length === 1) redirect(`/student/assessments/${assessments[0].id}`);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="bc-num text-[28px] md:text-[36px] leading-[1.05] mb-1">דוח האבחון שלי</h1>
      <p className="text-muted-foreground mb-6">הדוחות שהמאמנים כתבו עליך באירועי ההיכרות</p>

      {assessments.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">עדיין אין לך דוח אבחון</p>
      ) : (
        <div className="rounded-[18px] border bg-card divide-y overflow-hidden">
          {assessments.map((a) => (
            <Link
              key={a.id}
              href={`/student/assessments/${a.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="font-semibold text-[15px]">דוח אבחון</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.event_date)}</p>
              </div>
              <ChevronLeft size={16} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
