import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { STUDENT_NAV } from "@/components/nav-items";

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
  return <AppShell items={STUDENT_NAV}>{children}</AppShell>;
}
