import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sendWhatsAppMessage, sendWhatsAppFile, sendWhatsAppPoll, updateGroupSettings } from "@/lib/whatsapp/greenapi";

type Row = { id: string; chat_id: string; chat_name: string; message: string };
type CoachRow = { email: string; phone: string };

type ParsedMessage =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption: string }
  | { type: "poll"; question: string; options: string[] }
  | { type: "group_settings"; allowParticipantsSendMessages: boolean };

function parseMessage(raw: string): ParsedMessage {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.__type === "image" && typeof p.url === "string") {
      return { type: "image", url: p.url, caption: typeof p.caption === "string" ? p.caption : "" };
    }
    if (p.__type === "poll" && typeof p.question === "string" && Array.isArray(p.options)) {
      return { type: "poll", question: p.question, options: p.options as string[] };
    }
    if (p.__type === "group_settings" && typeof p.allowParticipantsSendMessages === "boolean") {
      return { type: "group_settings", allowParticipantsSendMessages: p.allowParticipantsSendMessages };
    }
  } catch {}
  return { type: "text", text: raw };
}

async function dispatchToTarget(chatId: string, raw: string): Promise<void> {
  const parsed = parseMessage(raw);

  if (chatId === "coaches:all") {
    const { data } = await db.from("coaches").select("email, phone").eq("active", true);
    for (const c of (data ?? []) as CoachRow[]) {
      if (c.phone) await dispatch(c.phone, parsed);
    }
    return;
  }
  if (chatId.startsWith("coach:")) {
    const email = chatId.slice("coach:".length);
    const { data } = await db.from("coaches").select("phone").eq("email", email).maybeSingle();
    if (data && (data as { phone: string }).phone) {
      await dispatch((data as { phone: string }).phone, parsed);
    }
    return;
  }
  await dispatch(chatId, parsed);
}

async function dispatch(target: string, msg: ParsedMessage): Promise<void> {
  if (msg.type === "text") return sendWhatsAppMessage(target, msg.text);
  if (msg.type === "image") return sendWhatsAppFile(target, msg.url, msg.caption);
  if (msg.type === "poll") return sendWhatsAppPoll(target, msg.question, msg.options);
  if (msg.type === "group_settings") return updateGroupSettings(target, msg.allowParticipantsSendMessages);
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
        await dispatchToTarget(row.chat_id, row.message);
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
