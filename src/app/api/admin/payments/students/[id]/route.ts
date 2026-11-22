import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { updatePaymentDetails } from "@/lib/sheets/payments";
import { PaymentBodyShape } from "@/lib/sheets/payment-body";

const Body = z.object(PaymentBodyShape);

// Edits a student's payment details from the finance tab.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const patch = Body.parse(await req.json());
    if ("payment_method" in patch) patch.payment_method = patch.payment_method || null;
    await updatePaymentDetails(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof z.ZodError) return new NextResponse("bad request", { status: 400 });
    console.error("[payments PATCH]", e);
    return new NextResponse("error", { status: 500 });
  }
}
