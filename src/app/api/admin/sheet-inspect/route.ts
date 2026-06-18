import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getSheetsClient } from "@/lib/google/sheets";

const SHEET_ID = "1JVTHG5UTnUe1bzZKct91EfpaEH4DUi8B8SbKT-45MU0";

export async function GET() {
  const user = await requireUser();
  if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });

  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);

  const previews: Record<string, string[][]> = {};
  for (const tab of tabs) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1:Z3`,
    });
    previews[tab as string] = (res.data.values ?? []) as string[][];
  }

  return NextResponse.json({ tabs, previews });
}
