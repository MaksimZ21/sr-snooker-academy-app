import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  await admin.auth.admin.inviteUserByEmail(email);
  revalidateTag("coaches", { expire: 0 });
  return email;
}
