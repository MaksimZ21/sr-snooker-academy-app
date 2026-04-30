import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, "..", "snooker-academy-494906-56e89d932e6e.json");
const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
  console.error("Usage: node scripts/seed-sheet.mjs <spreadsheetId>");
  process.exit(1);
}

const creds = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

const rows = {
  Coaches: [
    ["lior15250@gmail.com", "ליאור", "050-1234567", "TRUE"],
  ],
  Students: [
    ["S001", "אלי כהן", "052-1111111", "דן כהן", "052-2222222", "מתחיל, התחיל בינואר", "TRUE"],
    ["S002", "מאיה לוי", "053-3333333", "רותי לוי", "053-4444444", "", "TRUE"],
    ["S003", "יוסי בן-דוד", "054-5555555", "", "", "מתקדם", "TRUE"],
  ],
  Sessions: [
    [
      "SES-001",
      today,
      "17:00",
      "18:00",
      "lior15250@gmail.com",
      "private",
      "S001",
      "",
      "scheduled",
    ],
    [
      "SES-002",
      today,
      "18:30",
      "20:00",
      "lior15250@gmail.com",
      "group",
      "S002,S003",
      "",
      "scheduled",
    ],
  ],
  Guidelines: [
    ["G1", "טכניקה בסיסית", "1", "beginners", "אחיזת הסטיק", "החזק ביד דומיננטית, גובה החזה, שחרר את הכתפיים."],
    ["G2", "טכניקה בסיסית", "2", "beginners", "עמידה נכונה", "רגליים ברוחב הכתפיים, משקל מרוכז, ראש מעל הסטיק."],
    ["G3", "משחק", "1", "match-play", "תכנון מהלך", "תמיד תכנן 2 כדורים קדימה, לא רק את הבא."],
  ],
  Pricing: [
    ["שיעור פרטי", "60", "200", ""],
    ["שיעור פרטי", "90", "280", ""],
    ["שיעור קבוצתי (עד 4)", "90", "120", "מחיר למשתתף"],
    ["מנוי חודשי - 4 שיעורים", "60", "700", ""],
  ],
};

console.log(`Seeding ${SPREADSHEET_ID}...`);

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    valueInputOption: "USER_ENTERED",
    data: Object.entries(rows).map(([name, vals]) => ({
      range: `${name}!A2`,
      values: vals,
    })),
  },
});

console.log("Done.");
console.log("");
console.log("Seeded:");
console.log("  Coaches:    1 (you, as active)");
console.log("  Students:   3");
console.log(`  Sessions:   2 (both today, ${today})`);
console.log("  Guidelines: 3");
console.log("  Pricing:    4");
console.log("");
console.log("You also need to add yourself to ADMIN_EMAILS env var to land on /admin instead of /coach.");
