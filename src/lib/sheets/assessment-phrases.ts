import { getSheetsClient } from "@/lib/google/sheets";

const PHRASES_SHEET_ID = "1FEA2UKumCyVjDzZC71rWTbvIunJ_B77wkz7JU7-peS8";

export type Phrase = { category: string; text: string };

export async function fetchAssessmentPhrases(): Promise<Phrase[]> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PHRASES_SHEET_ID,
      range: "משפטים מוכנים!B5:C200",
    });

    const rows = (res.data.values ?? []) as string[][];
    const phrases: Phrase[] = [];
    let currentCategory = "";

    for (const row of rows) {
      const cat  = (row[0] ?? "").trim();
      const text = (row[1] ?? "").trim();
      if (cat) currentCategory = cat;
      if (text && currentCategory) phrases.push({ category: currentCategory, text });
    }

    return phrases;
  } catch {
    return [];
  }
}
