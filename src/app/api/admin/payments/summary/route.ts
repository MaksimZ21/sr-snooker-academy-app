import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getPaymentsSummaryPhone, sendPaymentsSummary } from "@/lib/sheets/payments-summary";

// "שלח סיכום עכשיו" — sends this week's payments summary right away.
export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const phone = await getPaymentsSummaryPhone();
    if (!phone) return NextResponse.json({ ok: false, error: "no_phone" }, { status: 400 });
    await sendPaymentsSummary(phone);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[payments summary]", e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
}
