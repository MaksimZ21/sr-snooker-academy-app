import React from "react";
import { NextResponse } from "next/server";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";
import { fetchCoachSalaryForMonth } from "@/lib/sheets/salary";
import { sendWhatsAppFileByUpload } from "@/lib/whatsapp/greenapi";
import { SalaryPdfDocument } from "@/components/salary-pdf";

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const Body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${HEBREW_MONTHS[m - 1]} ${y}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

    const { email } = await params;
    const { month } = Body.parse(await req.json());

    const { data: coachRow } = await db
      .from("coaches")
      .select("name, phone")
      .eq("email", email)
      .maybeSingle();
    if (!coachRow) {
      return NextResponse.json({ error: "מאמן לא נמצא" }, { status: 404 });
    }
    const coachName = (coachRow.name as string) || email;
    const phone = coachRow.phone as string;
    if (!phone) {
      return NextResponse.json({ error: "לא מוגדר מספר טלפון למאמן" }, { status: 400 });
    }

    const salary = await fetchCoachSalaryForMonth(email, month);
    if (!salary || salary.sessions.length === 0) {
      return NextResponse.json({ error: "אין אימונים לחודש זה" }, { status: 400 });
    }

    const label = monthLabel(month);
    const buffer = await renderToBuffer(
      <SalaryPdfDocument coach={salary} coachName={coachName} period={label} />,
    );
    await sendWhatsAppFileByUpload(
      phone,
      buffer,
      `דוח שכר - ${coachName} - ${label}.pdf`,
      "application/pdf",
      `📊 דוח שכר – ${label}`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
