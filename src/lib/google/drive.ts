import { google } from "googleapis";
import { unstable_cache } from "next/cache";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

export type DriveFolder = {
  id: string;
  name: string;
  files: DriveFile[];
  subfolders: DriveFolder[];
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const key = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

async function listChildren(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
): Promise<{ folders: DriveFile[]; files: DriveFile[] }> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink)",
    orderBy: "name",
    pageSize: 200,
  });
  const items = (res.data.files ?? []) as DriveFile[];
  return {
    folders: items.filter((f) => f.mimeType === FOLDER_MIME),
    files: items.filter((f) => f.mimeType !== FOLDER_MIME),
  };
}

async function buildTree(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  name: string,
): Promise<DriveFolder> {
  const { folders, files } = await listChildren(drive, folderId);
  const subfolders = await Promise.all(
    folders.map((f) => buildTree(drive, f.id, f.name)),
  );
  return { id: folderId, name, files, subfolders };
}

export async function listImagesInFolder(folderUrl: string): Promise<string[]> {
  const match = folderUrl.match(/[-\w]{25,}/);
  if (!match) return [];
  const folderId = match[0];
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: "files(id,webContentLink,thumbnailLink)",
    pageSize: 50,
  });
  return (res.data.files ?? [])
    .map((f) => f.thumbnailLink ?? f.webContentLink ?? "")
    .filter(Boolean) as string[];
}

const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID ?? "1B5QQ5fwgenRbB0hEIXTzH4Kt_soZd7nH";

export const fetchDriveTree = unstable_cache(
  async (): Promise<DriveFolder> => {
    const drive = getDriveClient();
    return buildTree(drive, ROOT_FOLDER_ID, "root");
  },
  ["drive:tree"],
  { revalidate: 300, tags: ["drive"] },
);
