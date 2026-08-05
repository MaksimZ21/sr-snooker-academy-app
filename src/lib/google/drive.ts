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
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");
  return google.drive({ version: "v3", auth: apiKey });
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
  process.env.GOOGLE_DRIVE_FOLDER_ID ?? "11wd_sIJFaZpG93Sqx9cukQe-XveDf-oS";

export const fetchDriveTree = unstable_cache(
  async (): Promise<DriveFolder> => {
    const drive = getDriveClient();
    return buildTree(drive, ROOT_FOLDER_ID, "root");
  },
  ["drive:tree"],
  { revalidate: 300, tags: ["drive"] },
);
