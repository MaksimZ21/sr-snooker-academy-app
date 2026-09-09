import { sendNotification, setVapidDetails } from "web-push";
import { db } from "@/lib/db/client";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID env vars not set — skipping push send");
    return false;
  }
  if (!configured) {
    setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends a Web Push notification to every registered admin device.
 * Never throws — a push failure (missing VAPID config, expired
 * subscription, network error) must never break the caller's own
 * operation (e.g. submitting a contact request).
 */
export async function sendPushToAdmins(payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;

    const emails = adminEmails();
    if (emails.length === 0) return;

    const { data } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_email", emails);
    const subs = (data ?? []) as SubscriptionRow[];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("[push] send failed", err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] sendPushToAdmins failed", err);
  }
}
