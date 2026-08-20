const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID!;
const TOKEN = process.env.GREENAPI_TOKEN!;
const BASE = () => `https://api.green-api.com/waInstance${INSTANCE_ID}`;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("972") ? digits : `972${digits.replace(/^0/, "")}`;
  return `${normalized}@c.us`;
}

function toChatId(phoneOrChatId: string): string {
  return phoneOrChatId.includes("@") ? phoneOrChatId : formatPhone(phoneOrChatId);
}

export async function sendWhatsAppMessage(phoneOrChatId: string, message: string): Promise<void> {
  const chatId = toChatId(phoneOrChatId);
  const res = await fetch(`${BASE()}/sendMessage/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API ${res.status}: ${text}`);
  }
}

export async function sendWhatsAppFile(
  phoneOrChatId: string,
  urlFile: string,
  caption: string,
  fileName?: string,
): Promise<void> {
  const chatId = toChatId(phoneOrChatId);
  const ext = urlFile.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  const resolvedName = fileName ?? `file.${ext}`;
  const res = await fetch(`${BASE()}/sendFileByUrl/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, urlFile, fileName: resolvedName, caption }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendFileByUrl ${res.status}: ${text}`);
  }
}

export async function sendWhatsAppFileByUpload(
  phoneOrChatId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  caption: string,
): Promise<void> {
  const chatId = toChatId(phoneOrChatId);
  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  // RFC 5987 percent-encoding so non-ASCII (Hebrew) filenames survive the HTTP boundary
  const encodedFileName = encodeURIComponent(fileName);

  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="chatId"\r\n\r\n${chatId}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename*=UTF-8''${encodedFileName}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    "utf-8",
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
  const body = new Uint8Array(Buffer.concat([header, fileBuffer, footer]));

  const res = await fetch(`${BASE()}/sendFileByUpload/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendFileByUpload ${res.status}: ${text}`);
  }
}

export async function sendWhatsAppPoll(
  phoneOrChatId: string,
  message: string,
  options: string[],
  multipleAnswers = false,
): Promise<void> {
  const chatId = toChatId(phoneOrChatId);
  const res = await fetch(`${BASE()}/sendPoll/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId,
      message,
      options: options.map((o) => ({ optionName: o })),
      multipleAnswers,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendPoll ${res.status}: ${text}`);
  }
}

export type WhatsAppGroup = { id: string; name: string };

export async function getWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const res = await fetch(`${BASE()}/getChats/${TOKEN}`, { method: "GET" });
  if (!res.ok) throw new Error(`Green API getChats ${res.status}`);
  const data = await res.json() as { id?: string; name?: string }[];
  // Green API's getChats response doesn't include a `type` field — group chats
  // are identified by their id suffix (`@g.us`), same convention already used
  // for chat_id elsewhere in this app (see whatsapp_scheduled / cron docs).
  return data
    .filter((c) => c.id?.endsWith("@g.us"))
    .map((c) => ({ id: c.id!, name: c.name || c.id! }));
}

// groupId is already fully-qualified (e.g. from getWhatsAppGroups, ending in
// @g.us) — do not run it through toChatId/formatPhone, which is for phone
// numbers only and would mangle a group id.
export async function updateGroupSettings(
  groupId: string,
  allowParticipantsSendMessages: boolean,
): Promise<void> {
  const res = await fetch(`${BASE()}/updateGroupSettings/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId, allowParticipantsSendMessages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API updateGroupSettings ${res.status}: ${text}`);
  }
}
