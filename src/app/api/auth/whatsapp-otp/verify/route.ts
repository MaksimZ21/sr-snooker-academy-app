import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/client";

function verifyToken(token: string, code: string): { phone: string } | null {
  try {
    const { phone, expiresAt, sig } = JSON.parse(
      Buffer.from(token, "base64url").toString(),
    ) as { phone: string; expiresAt: number; sig: string };

    if (Date.now() > expiresAt) return null;

    const expected = createHmac("sha256", process.env.OTP_SECRET!)
      .update(`${phone}:${code}:${expiresAt}`)
      .digest("hex");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return { phone };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { token, code } = (await req.json()) as { token?: string; code?: string };
    if (!token || !code) return NextResponse.json({ error: "missing fields" }, { status: 400 });

    const result = verifyToken(token, code.trim());
    if (!result) return NextResponse.json({ error: "קוד שגוי או פג תוקף" }, { status: 401 });

    const { phone } = result;
    const intl = `972${phone.slice(1)}`;

    const [{ data: coachRow }, { data: studentRow }] = await Promise.all([
      db.from("coaches").select("email").or(`phone.eq.${phone},phone.eq.${intl}`).eq("active", true).maybeSingle(),
      db.from("students").select("email").or(`phone.eq.${phone},phone.eq.${intl}`).eq("active", true).maybeSingle(),
    ]);

    const email =
      (coachRow as { email: string } | null)?.email ??
      (studentRow as { email: string } | null)?.email;

    if (!email) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });

    const origin = new URL(req.url).origin;
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/` },
    });

    if (error || !data.properties?.action_link) {
      console.error("generateLink error", error);
      return NextResponse.json({ error: "שגיאת כניסה" }, { status: 500 });
    }

    return NextResponse.json({ actionLink: data.properties.action_link });
  } catch (e) {
    console.error("whatsapp-otp/verify", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
