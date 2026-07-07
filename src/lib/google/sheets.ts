import { google } from "googleapis";

let cached: ReturnType<typeof google.sheets> | null = null;

export function getSheetsClient() {
  if (cached) return cached;
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  cached = google.sheets({ version: "v4", auth });
  return cached;
}

let cachedDrive: ReturnType<typeof google.drive> | null = null;

export function getDriveClient() {
  if (cachedDrive) return cachedDrive;
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

export function getSheetId(): string {
  return process.env.GOOGLE_SHEET_ID!;
}
