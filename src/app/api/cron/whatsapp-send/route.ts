import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi";

type Row = { id: string; chat_id: string; chat_name: string; message: string };

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
        await sendWhatsAppMessage(row.chat_id, row.message);
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
