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

// For anything a logged-in student must not reach: their login is valid, so
// requireUser alone lets them through.
export async function requireStaff(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "coach") throw new Response("Forbidden", { status: 403 });
  return user;
}
