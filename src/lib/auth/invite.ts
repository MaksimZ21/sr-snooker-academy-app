import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function sendLoginInvite(email: string, origin: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const redirectTo = `${origin}/auth/callback?next=/set-password`;

  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error) return;

  // Most common failure here is "user already registered" (e.g. re-sending to
  // an existing coach/student) — fall back to a password-reset email instead.
  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) throw new Error(`invite_failed: ${resetError.message}`);
}
