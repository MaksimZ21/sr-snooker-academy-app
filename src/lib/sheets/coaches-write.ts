import { revalidateTag } from "next/cache";
import { getSheetsClient, getSheetId } from "@/lib/google/sheets";

const RANGE_FULL = "Coaches!A:D";

export async function appendCoach(input: {
  email: string;
  name: string;
  phone?: string;
}) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: RANGE_FULL,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        input.email.trim().toLowerCase(),
        input.name,
        input.phone ?? "",
        "TRUE",
      ]],
    },
  });
  revalidateTag("coaches", { expire: 0 });
  return input.email.trim().toLowerCase();
}
