import { getDriveClient } from "./sheets";

function folderIdFromUrl(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

export async function listImagesInFolder(url: string) {
  const id = folderIdFromUrl(url);
  if (!id) return [];
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${id}' in parents and trashed = false and mimeType contains 'image/'`,
    fields: "files(id, name, thumbnailLink, webContentLink)",
    pageSize: 200,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    thumbnailUrl: f.thumbnailLink ?? `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
    fullUrl: `https://drive.google.com/uc?id=${f.id}`,
  }));
}
