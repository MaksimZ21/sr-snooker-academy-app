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

export async function getMonthlyReportPaused(): Promise<boolean> {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "monthly_report_paused")
    .maybeSingle();
  return data?.value === "true";
}

export async function setMonthlyReportPaused(paused: boolean): Promise<void> {
  await db
    .from("settings")
    .upsert({ key: "monthly_report_paused", value: String(paused) });
}
