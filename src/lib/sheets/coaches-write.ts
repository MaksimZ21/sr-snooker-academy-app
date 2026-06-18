import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function updateCoach(input: {
  email: string;
  name: string;
  phone?: string;
}): Promise<void> {
  const { error } = await db
    .from("coaches")
    .update({ name: input.name, phone: input.phone ?? "" })
    .eq("email", input.email.trim().toLowerCase());
  if (error) throw new Error(`db_update_failed: ${error.message}`);
  revalidateTag("coaches", { expire: 0 });
}

export async function deleteCoach(email: string) {
  const admin = createSupabaseAdminClient();
  await db.from("coaches").delete().eq("email", email);
  const { data } = await admin.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  revalidateTag("coaches", { expire: 0 });
}

export async function appendCoach(input: {
  email: string;
  name: string;
  phone?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const { error: upsertError } = await db.from("coaches").upsert(
    { email, name: input.name, phone: input.phone ?? "", active: true },
    { onConflict: "email" },
  );
  if (upsertError) throw new Error(`db_upsert_failed: ${upsertError.message}`);
  const admin = createSupabaseAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sr-snooker-academy-app.vercel.app";
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });
  if (error) {
    // User already exists — send a password reset email instead
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
    });
    if (resetError) throw new Error(`invite_failed: ${resetError.message}`);
  }
  revalidateTag("coaches", { expire: 0 });
  return email;
}
