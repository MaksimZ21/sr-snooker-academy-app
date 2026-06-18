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
): Promise<void> {
  const chatId = toChatId(phoneOrChatId);
  const ext = urlFile.split(".").pop()?.toLowerCase() ?? "jpg";
  const res = await fetch(`${BASE()}/sendFileByUrl/${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, urlFile, fileName: `file.${ext}`, caption }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API sendFileByUrl ${res.status}: ${text}`);
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
  const data = await res.json() as { id?: string; name?: string; type?: string }[];
  return data
    .filter((c) => c.type === "group" && c.id && c.name)
    .map((c) => ({ id: c.id!, name: c.name! }));
}
