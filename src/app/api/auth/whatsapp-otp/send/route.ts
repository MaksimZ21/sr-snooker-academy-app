import { NextResponse } from "next/server";
import { createHmac, randomInt } from "crypto";
import { db } from "@/lib/db/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";

function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  const core = d.startsWith("972") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
  return { local: `0${core}`, intl: `972${core}` };
}

export function signOtp(phone: string, code: string, expiresAt: number): string {
  const sig = createHmac("sha256", process.env.OTP_SECRET!)
    .update(`${phone}:${code}:${expiresAt}`)
    .digest("hex");
  return Buffer.from(JSON.stringify({ phone, expiresAt, sig })).toString("base64url");
}

export async function POST(req: Request) {
  try {
    const { phone } = (await req.json()) as { phone?: string };
    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

    const { local, intl } = normalizePhone(phone);

    const [{ data: coachRow }, { data: studentRow }] = await Promise.all([
      db.from("coaches").select("email").or(`phone.eq.${local},phone.eq.${intl}`).eq("active", true).maybeSingle(),
      db.from("students").select("email").or(`phone.eq.${local},phone.eq.${intl}`).eq("active", true).maybeSingle(),
    ]);

    const email =
      (coachRow as { email: string } | null)?.email ??
      (studentRow as { email: string } | null)?.email;

    // Return ok even if not found — avoids leaking which phones are registered
    if (!email) return NextResponse.json({ ok: true, token: null });

    const code = String(randomInt(100000, 999999));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const token = signOtp(local, code, expiresAt);

    await sendWhatsAppMessage(local, `קוד הכניסה שלך לאקדמיית סנוקר: *${code}*\nתקף ל-10 דקות.`);

    return NextResponse.json({ ok: true, token });
  } catch (e) {
    console.error("whatsapp-otp/send", e);
    return NextResponse.json({ error: "שגיאה בשליחה" }, { status: 500 });
  }
}
