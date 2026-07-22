import { db } from "@/lib/db/client";

export async function getCrmPaused(): Promise<boolean> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "crm_paused")
    .maybeSingle();
  return data?.value === "true";
}

export async function setCrmPaused(paused: boolean): Promise<void> {
  await db
    .from("settings")
    .upsert({ key: "crm_paused", value: String(paused) });
}
