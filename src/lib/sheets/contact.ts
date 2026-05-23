import { db } from "@/lib/db/client";

export type ContactRequest = {
  id: string;
  student_id: string;
  subject: string;
  message: string;
  status: "new" | "read";
  created_at: string;
};

export async function insertContactRequest(input: {
  student_id: string;
  subject: string;
  message: string;
}): Promise<void> {
  await db.from("contact_requests").insert({
    student_id: input.student_id,
    subject: input.subject,
    message: input.message,
  });
}

export async function fetchContactRequests(): Promise<ContactRequest[]> {
  const { data } = await db
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as ContactRequest[];
}

export async function markContactRequestRead(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "read" }).eq("id", id);
}

export async function countNewContactRequests(): Promise<number> {
  const { count } = await db
    .from("contact_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
}
