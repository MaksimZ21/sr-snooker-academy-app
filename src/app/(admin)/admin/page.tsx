import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { AdminDashboard } from "@/components/admin-dashboard";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let displayName = "";
  if (session?.user?.email) {
    const { data } = await db
      .from("coaches")
      .select("name")
      .eq("email", session.user.email)
      .maybeSingle();
    displayName = (data?.name as string | null) ?? session.user.email.split("@")[0];
  }

  return <AdminDashboard displayName={displayName} />;
}
