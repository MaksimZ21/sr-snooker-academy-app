import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { AppShell } from "@/components/app-shell";
import { ADMIN_NAV } from "@/components/nav-items";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const role = await getUserRole(session.user.email!);
  if (role !== "admin") redirect("/coach");
  return <AppShell items={ADMIN_NAV}>{children}</AppShell>;
}
