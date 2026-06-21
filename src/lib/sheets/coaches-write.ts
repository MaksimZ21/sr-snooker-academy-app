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
  // Create auth user silently (no invite email) — coach logs in via WhatsApp OTP
  await admin.auth.admin.createUser({ email, email_confirm: true });
  // Ignore "already exists" error — user was already created on a previous add or first login
  revalidateTag("coaches", { expire: 0 });
  return email;
}
