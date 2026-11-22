import { db } from "@/lib/db/client";
import { revalidateTag } from "next/cache";
import { addDays, format, parseISO } from "date-fns";
import { todayIsoTel } from "@/lib/date";
import { firstTrainingAfter, nextRenewalDate, type PaymentFields } from "./payments-logic";

export type PaymentGroup = {
  id: string;
  name: string;
  college_name: string;
  coach_name: string;
  start_time: string;
};

export type PaymentBoardRow = PaymentFields & {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  college_name: string;
  last_payment_date: string | null;
  first_training_date: string | null;
  payment_notes: string;
  group: PaymentGroup | null;
};

type StudentPaymentRow = Omit<PaymentBoardRow, "group">;

const STUDENT_COLUMNS =
  "id, first_name, last_name, phone, college_name, payment_method, payment_amount, last_payment_date, next_payment_date, first_training_date, payment_notes, payment_frozen";

// Every active academy student (not tournament-only players) with their
// payment details and the group they train in, for the finance tab and the
// Sunday summary.
export async function fetchPaymentBoard(): Promise<PaymentBoardRow[]> {
  const [studentsRes, groupsRes, coachesRes] = await Promise.all([
    db.from("students").select(STUDENT_COLUMNS).eq("active", true).eq("is_tournament_only", false),
    db.from("groups").select("id, name, student_ids, college_name, coach_email, start_time").order("name"),
    db.from("coaches").select("email, name"),
  ]);
  if (studentsRes.error) throw new Error(studentsRes.error.message);

  const coachName = new Map(((coachesRes.data ?? []) as { email: string; name: string }[]).map((c) => [c.email, c.name]));
  const groupOf = new Map<string, PaymentGroup>();
  for (const g of (groupsRes.data ?? []) as {
    id: string;
    name: string;
    student_ids: string[] | null;
    college_name: string | null;
    coach_email: string | null;
    start_time: string | null;
  }[]) {
    const group: PaymentGroup = {
      id: g.id,
      name: g.name,
      college_name: g.college_name ?? "",
      coach_name: coachName.get(g.coach_email ?? "") ?? "",
      start_time: g.start_time ?? "",
    };
    // A student in two groups is listed under the first one.
    for (const sid of g.student_ids ?? []) if (!groupOf.has(sid)) groupOf.set(sid, group);
  }

  return ((studentsRes.data ?? []) as StudentPaymentRow[]).map((s) => ({
    ...s,
    payment_notes: s.payment_notes ?? "",
    payment_frozen: s.payment_frozen ?? false,
    group: groupOf.get(s.id) ?? null,
  }));
}

export type PaymentDetailsPatch = {
  payment_method?: string | null;
  payment_amount?: number | null;
  last_payment_date?: string | null;
  next_payment_date?: string | null;
  first_training_date?: string | null;
  payment_notes?: string;
  payment_frozen?: boolean;
};

export async function updatePaymentDetails(studentId: string, patch: PaymentDetailsPatch): Promise<void> {
  const { error } = await db.from("students").update(patch).eq("id", studentId);
  if (error) throw new Error(error.message);
  revalidateTag("students", { expire: 0 });
}

// The student's first training on or after a day: the sessions of the groups
// they're in (and sessions they're on by name), not cancelled. Looks back two
// months so a group with nothing scheduled yet can be rolled forward.
async function findFirstTraining(studentId: string, fromIso: string): Promise<string | null> {
  const since = format(addDays(parseISO(fromIso), -60), "yyyy-MM-dd");
  const { data: groups } = await db.from("groups").select("id").contains("student_ids", [studentId]);
  const groupIds = ((groups ?? []) as { id: string }[]).map((g) => g.id);
  const [byGroup, byName] = await Promise.all([
    groupIds.length
      ? db.from("sessions").select("date").in("group_id", groupIds).neq("status", "cancelled").gte("date", since)
      : Promise.resolve({ data: [] as { date: string }[] }),
    db.from("sessions").select("date").contains("student_ids", [studentId]).neq("status", "cancelled").gte("date", since),
  ]);
  const dates = [...(byGroup.data ?? []), ...(byName.data ?? [])].map((r) => (r as { date: string }).date);
  return firstTrainingAfter(fromIso, dates);
}

// "שולם": records the payment, moves the renewal a month on and finds the
// first training after it. Returns the payment id (so the press can be
// undone) and that training date.
export async function recordPayment(
  studentId: string,
  markedBy: string,
  // The day the money came in; today when not given.
  paidOnIso?: string,
): Promise<{ paymentId: string; firstTraining: string | null }> {
  const { data: student, error } = await db
    .from("students")
    .select("payment_method, payment_amount, last_payment_date, next_payment_date, first_training_date")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!student) throw new Error("student not found");

  const today = paidOnIso ?? todayIsoTel();
  const covered = (student.next_payment_date as string | null) ?? null;
  const firstTraining = await findFirstTraining(studentId, today);
  const { data: payment, error: insertError } = await db
    .from("student_payments")
    .insert({
      student_id: studentId,
      paid_on: today,
      amount: student.payment_amount,
      method: student.payment_method,
      covered_date: covered,
      prev_last_payment_date: student.last_payment_date,
      prev_next_payment_date: student.next_payment_date,
      first_training_date: firstTraining,
      prev_first_training_date: student.first_training_date,
      marked_by: markedBy,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  await updatePaymentDetails(studentId, {
    last_payment_date: today,
    next_payment_date: nextRenewalDate(covered, today),
    first_training_date: firstTraining,
  });
  return { paymentId: payment.id as string, firstTraining };
}

// Puts the student's dates back to what they were before the press.
export async function undoPayment(paymentId: string): Promise<void> {
  const { data: payment, error } = await db
    .from("student_payments")
    .select("student_id, prev_last_payment_date, prev_next_payment_date, prev_first_training_date")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!payment) return;
  await updatePaymentDetails(payment.student_id as string, {
    last_payment_date: payment.prev_last_payment_date as string | null,
    next_payment_date: payment.prev_next_payment_date as string | null,
    first_training_date: payment.prev_first_training_date as string | null,
  });
  const { error: deleteError } = await db.from("student_payments").delete().eq("id", paymentId);
  if (deleteError) throw new Error(deleteError.message);
}
