import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStudentByEmail } from "@/lib/sheets/students";
import { StudentGoalView } from "@/components/student-goal-view";

export default async function StudentGoalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user.email) redirect("/login");
  const student = await getStudentByEmail(session.user.email);
  if (!student) redirect("/student");
  return <StudentGoalView studentId={student.id} />;
}
