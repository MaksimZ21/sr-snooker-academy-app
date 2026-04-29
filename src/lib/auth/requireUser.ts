import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserRole } from "./getUserRole";
import type { Role } from "./resolveRole";

export type AuthedUser = { email: string; role: Role };

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Response("Unauthorized", { status: 401 });
  const role = await getUserRole(user.email);
  if (role === "denied") throw new Response("Forbidden", { status: 403 });
  return { email: user.email, role };
}
