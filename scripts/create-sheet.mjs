import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KEY_PATH = resolve(__dirname, "..", "snooker-academy-494906-56e89d932e6e.json");
const SHARE_WITH = "lior15250@gmail.com";
const TITLE = process.argv[2] ?? "Snooker Academy";

const TABS = [
  { name: "Coaches", headers: ["email", "name", "phone", "active"] },
  {
    name: "Students",
    headers: ["id", "name", "phone", "parent_name", "parent_phone", "general_notes", "active"],
  },
  {
    name: "Sessions",
    headers: [
      "id",
      "date",
      "start_time",
      "end_time",
      "coach_email",
      "training_type",
      "student_ids",
      "drive_folder_url",
      "status",
    ],
  },
  { name: "Attendance", headers: ["session_id", "student_id", "status", "marked_by", "marked_at"] },
  {
    name: "Notes",
    headers: ["id", "student_id", "session_id", "coach_email", "text", "created_at"],
  },
  {
    name: "Guidelines",
    headers: ["id", "category", "order", "training_type", "title", "body_or_link"],
  },
  { name: "Pricing", headers: ["lesson_type", "duration_min", "price_nis", "notes"] },
];

const creds = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

console.log(`Service account: ${creds.client_email}`);
console.log(`Creating spreadsheet "${TITLE}"...`);

const create = await sheets.spreadsheets.create({
  requestBody: {
    properties: { title: TITLE, locale: "iw_IL", timeZone: "Asia/Jerusalem" },
    sheets: TABS.map((tab, i) => ({
      properties: { sheetId: i + 1, title: tab.name, index: i },
    })),
  },
});

const spreadsheetId = create.data.spreadsheetId;
console.log(`Created. ID: ${spreadsheetId}`);

const defaultSheet = create.data.sheets?.find((s) => s.properties?.title === "Sheet1");
const requests = [];
if (defaultSheet?.properties?.sheetId !== undefined) {
  requests.push({ deleteSheet: { sheetId: defaultSheet.properties.sheetId } });
}
requests.push(
  ...TABS.map((tab, i) => ({
    repeatCell: {
      range: { sheetId: i + 1, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat.bold",
    },
  })),
);
requests.push(
  ...TABS.map((tab, i) => ({
    updateSheetProperties: {
      properties: { sheetId: i + 1, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  })),
);
await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: { requests },
});
console.log("Removed default Sheet1, bolded headers, froze row 1.");

console.log("Writing headers...");
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: "RAW",
    data: TABS.map((tab) => ({
      range: `${tab.name}!A1`,
      values: [tab.headers],
    })),
  },
});
console.log("Headers written.");

console.log(`Sharing with ${SHARE_WITH} (Editor)...`);
await drive.permissions.create({
  fileId: spreadsheetId,
  requestBody: { type: "user", role: "writer", emailAddress: SHARE_WITH },
  sendNotificationEmail: false,
});

const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
console.log("");
console.log("=== DONE ===");
console.log(`Title:           ${TITLE}`);
console.log(`Spreadsheet ID:  ${spreadsheetId}`);
console.log(`URL:             ${url}`);
console.log(`Shared with:     ${SHARE_WITH} (Editor)`);
