import { db } from "@/lib/db/client";

export async function logWebhook(entry: {
  route: string;
  event_type?: string;
  params: Record<string, unknown>;
  status: "ok" | "error" | "skipped" | "not_found" | "invalid";
  result?: unknown;
}) {
  try {
    await db.from("webhook_logs").insert({
      route:      entry.route,
      event_type: entry.event_type ?? null,
      params:     entry.params,
      status:     entry.status,
      result:     entry.result ?? null,
    });
  } catch {
    // never block the webhook itself
  }
}
