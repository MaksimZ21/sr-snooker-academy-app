import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";

type Row = { id: string; chat_id: string; chat_name: string; message: string };
type CoachRow = { email: string; phone: string };

async function sendToTarget(chatId: string, message: string): Promise<void> {
  if (chatId === "coaches:all") {
    const { data } = await db.from("coaches").select("email, phone").eq("active", true);
    const coaches = (data ?? []) as CoachRow[];
    for (const c of coaches) {
      if (c.phone) await sendWhatsAppMessage(c.phone, message);
    }
    return;
  }
  if (chatId.startsWith("coach:")) {
    const email = chatId.slice("coach:".length);
    const { data } = await db.from("coaches").select("phone").eq("email", email).maybeSingle();
    if (data && (data as { phone: string }).phone) {
      await sendWhatsAppMessage((data as { phone: string }).phone, message);
    }
    return;
  }
  await sendWhatsAppMessage(chatId, message);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const { data } = await db
      .from("whatsapp_scheduled")
      .select("id, chat_id, chat_name, message")
      .eq("status", "pending")
      .lte("scheduled_at", now);

    const rows = (data ?? []) as Row[];
    let sent = 0;

    for (const row of rows) {
      try {
        await sendToTarget(row.chat_id, row.message);
        await db.from("whatsapp_scheduled").update({ status: "sent" }).eq("id", row.id);
        sent++;
      } catch (e) {
        console.error(`[whatsapp-send] failed for ${row.chat_id}:`, e);
        await db.from("whatsapp_scheduled").update({ status: "failed" }).eq("id", row.id);
      }
    }

    return NextResponse.json({ ok: true, sent, total: rows.length });
  } catch (e) {
    console.error("[whatsapp-send]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
