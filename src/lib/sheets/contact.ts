import { db } from "@/lib/db/client";
import { sendPushToAdmins } from "@/lib/push/send";

export type ContactRequest = {
  id: string;
  student_id: string;
  subject: string;
  message: string;
  status: "new" | "read" | "handled";
  created_at: string;
  student_name: string;
  student_phone: string;
};

export async function insertContactRequest(input: {
  student_id: string;
  subject: string;
  message: string;
}): Promise<void> {
  const { error } = await db.from("contact_requests").insert({
    student_id: input.student_id,
    subject: input.subject,
    message: input.message,
  });
  // If the insert itself failed, don't page every admin about a request
  // that was never actually saved.
  if (error) return;

  const { data: student } = await db
    .from("students")
    .select("first_name, last_name")
    .eq("id", input.student_id)
    .maybeSingle();
  const studentName = student
    ? [student.first_name, student.last_name].filter(Boolean).join(" ") || "מתאמן"
    : "מתאמן";

  // Awaited (not fire-and-forget): sendPushToAdmins never throws, so this
  // only costs latency — but on a serverless platform, an un-awaited call
  // can be dropped once the response is sent, silently losing the push.
  await sendPushToAdmins({
    title: "פנייה חדשה",
    body: `${studentName}: ${input.subject}`,
    url: "/admin/messages",
  });
}

export async function fetchContactRequests(): Promise<ContactRequest[]> {
  const { data } = await db
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Omit<ContactRequest, "student_name" | "student_phone">[];

  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: studentRows } = studentIds.length
    ? await db.from("students").select("id, first_name, last_name, phone").in("id", studentIds)
    : { data: [] as { id: string; first_name: string; last_name: string; phone: string }[] };
  const studentsById = new Map((studentRows ?? []).map((s) => [s.id as string, s]));

  return rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      ...r,
      student_name: s ? [s.first_name, s.last_name].filter(Boolean).join(" ") || "מתאמן" : "מתאמן לא ידוע",
      student_phone: (s?.phone as string) ?? "",
    };
  });
}

export async function markContactRequestRead(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "read" }).eq("id", id);
}

export async function markContactRequestHandled(id: string): Promise<void> {
  await db.from("contact_requests").update({ status: "handled" }).eq("id", id);
}

export async function countNewContactRequests(): Promise<number> {
  const { count } = await db
    .from("contact_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
}
