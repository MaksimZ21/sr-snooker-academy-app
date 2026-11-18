import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { STUDENT_NAV } from "@/components/nav-items";
import { getStudentByEmail } from "@/lib/sheets/students";
import { fetchAssessmentsForStudent } from "@/lib/sheets/assessments";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getUserRole(user.email!);
  if (role !== "student") redirect("/denied");
  const student = await getStudentByEmail(user.email!);
  const hasAssessments = student ? (await fetchAssessmentsForStudent(student)).length > 0 : false;
  const items = hasAssessments ? STUDENT_NAV : STUDENT_NAV.filter((i) => i.href !== "/student/assessments");
  return <AppShell items={items}>{children}</AppShell>;
}
