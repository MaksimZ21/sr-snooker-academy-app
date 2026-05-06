import { revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";

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
  revalidateTag("coaches", { expire: 0 });
  return email;
}
