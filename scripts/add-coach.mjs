import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, "..", "snooker-academy-494906-56e89d932e6e.json");

const SPREADSHEET_ID = process.argv[2];
const EMAIL = process.argv[3];
const NAME = process.argv[4] ?? "";
const PHONE = process.argv[5] ?? "";

if (!SPREADSHEET_ID || !EMAIL) {
  console.error("Usage: node scripts/add-coach.mjs <spreadsheetId> <email> [name] [phone]");
  process.exit(1);
}

const creds = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: "Coaches!A:D",
  valueInputOption: "USER_ENTERED",
  requestBody: { values: [[EMAIL, NAME, PHONE, "TRUE"]] },
});

console.log(`Added coach: ${EMAIL} (${NAME})`);
