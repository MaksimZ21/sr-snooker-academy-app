import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchPaymentBoard, recordPayment, type PaymentBoardRow } from "@/lib/sheets/payments";

export type PaymentBoardResponse = { rows: PaymentBoardRow[] };

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await fetchPaymentBoard();
    return NextResponse.json<PaymentBoardResponse>({ rows });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[payments GET]", e);
    return new NextResponse("error", { status: 500 });
  }
}

const RecordBody = z.object({ student_id: z.string().min(1) });

// "שולם" — records a payment and moves the renewal date a month on.
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const { student_id } = RecordBody.parse(await req.json());
    const paymentId = await recordPayment(student_id, user.email);
    return NextResponse.json({ ok: true, payment_id: paymentId });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[payments POST]", e);
    return new NextResponse("error", { status: 500 });
  }
}
