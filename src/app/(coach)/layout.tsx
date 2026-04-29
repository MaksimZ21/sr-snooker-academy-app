import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { COACH_NAV } from "@/components/nav-items";

export default async function CoachLayout({
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
  if (role === "denied") redirect("/denied");
  if (role === "admin") redirect("/admin");
  return <AppShell items={COACH_NAV}>{children}</AppShell>;
}
