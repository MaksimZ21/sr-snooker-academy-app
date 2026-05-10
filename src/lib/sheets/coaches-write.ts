import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  await db.from("coaches").insert({
    email,
    name: input.name,
    phone: input.phone ?? "",
    active: true,
  });
  const admin = createSupabaseAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sr-snooker-academy-app.vercel.app";
  await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/set-password`,
  });
  revalidateTag("coaches", { expire: 0 });
  return email;
}
