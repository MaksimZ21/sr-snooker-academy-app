import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db/client";
import type { SessionPricingRule } from "./session-pricing-shared";

// Server-only data access for session_pricing_rules. Never import this
// file from a "use client" component — it eagerly constructs the
// service-role Supabase client. Client components needing the
// SessionPricingRule type or resolveSessionPricing should import from
// "./session-pricing-shared" instead.
export type { SessionPricingRule } from "./session-pricing-shared";
export { resolveSessionPricing } from "./session-pricing-shared";

export const fetchSessionPricingRules = unstable_cache(
  async (): Promise<SessionPricingRule[]> => {
    const { data } = await db
      .from("session_pricing_rules")
      .select("id, label, price_nis")
      .order("created_at");
    return (data ?? []) as SessionPricingRule[];
  },
  ["session-pricing-rules:all"],
  { revalidate: 300, tags: ["session-pricing-rules"] },
);

export async function appendSessionPricingRule(input: {
  label: string;
  price_nis: number;
}): Promise<void> {
  await db.from("session_pricing_rules").insert({
    label: input.label,
    price_nis: input.price_nis,
  });
  revalidateTag("session-pricing-rules", { expire: 0 });
}

export async function deleteSessionPricingRule(id: string): Promise<void> {
  await db.from("session_pricing_rules").delete().eq("id", id);
  revalidateTag("session-pricing-rules", { expire: 0 });
}
