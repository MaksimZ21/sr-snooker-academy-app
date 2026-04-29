import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/getUserRole";
import { ProfileCard } from "@/components/profile-card";

export default async function Page() {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  const role = await getUserRole(user!.email!);
  return <ProfileCard email={user!.email!} role={role} />;
}
