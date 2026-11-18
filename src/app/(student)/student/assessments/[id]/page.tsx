import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchAssessmentsForStudent } from "@/lib/sheets/assessments";
import { AssessmentDetailView } from "@/components/assessment-detail-view";

export default async function StudentAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const student = await getStudentByEmail(user.email!);
  if (!student) redirect("/denied");

  const mine = await fetchAssessmentsForStudent(student);
  if (!mine.some((a) => a.id === id)) notFound();

  return (
    <AssessmentDetailView
      assessmentId={id}
      backHref={mine.length > 1 ? "/student/assessments" : "/student"}
      backLabel={mine.length > 1 ? "דוחות האבחון שלי" : "חזרה"}
      readOnly
    />
  );
}
