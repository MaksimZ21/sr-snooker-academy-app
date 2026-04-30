import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KEY_PATH = resolve(__dirname, "..", "snooker-academy-494906-56e89d932e6e.json");
const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
  console.error("Usage: node scripts/populate-sheet.mjs <spreadsheetId>");
  process.exit(1);
}

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

console.log(`Service account: ${creds.client_email}`);
console.log(`Reading current state of ${SPREADSHEET_ID}...`);

const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const existingTabs = (meta.data.sheets ?? []).map((s) => ({
  id: s.properties?.sheetId,
  title: s.properties?.title,
}));
console.log(`Existing tabs: ${existingTabs.map((t) => t.title).join(", ") || "(none)"}`);

const requests = [];

for (const tab of TABS) {
  const exists = existingTabs.find((e) => e.title === tab.name);
  if (!exists) {
    requests.push({ addSheet: { properties: { title: tab.name } } });
  }
}

const tabsToDelete = existingTabs.filter((t) => !TABS.find((x) => x.name === t.title));
for (const t of tabsToDelete) {
  if (t.id !== undefined && t.id !== null) {
    requests.push({ deleteSheet: { sheetId: t.id } });
  }
}

if (requests.length > 0) {
  console.log(`Applying ${requests.length} structural changes (adds/deletes)...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}

const meta2 = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const tabIdByName = {};
for (const s of meta2.data.sheets ?? []) {
  if (s.properties?.title) tabIdByName[s.properties.title] = s.properties.sheetId;
}

console.log("Writing headers...");
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    valueInputOption: "RAW",
    data: TABS.map((tab) => ({
      range: `${tab.name}!A1`,
      values: [tab.headers],
    })),
  },
});

console.log("Bolding headers and freezing row 1...");
const formatRequests = [];
for (const tab of TABS) {
  const sheetId = tabIdByName[tab.name];
  if (sheetId === undefined) continue;
  formatRequests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat.bold",
    },
  });
  formatRequests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });
}
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: { requests: formatRequests },
});

console.log("");
console.log("=== DONE ===");
console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
console.log(`URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
console.log(`Tabs: ${TABS.map((t) => t.name).join(", ")}`);
