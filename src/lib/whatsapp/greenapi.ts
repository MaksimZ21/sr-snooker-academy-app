const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID!;
const TOKEN = process.env.GREENAPI_TOKEN!;
const BASE = () => `https://api.green-api.com/waInstance${INSTANCE_ID}`;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("972") ? digits : `972${digits.replace(/^0/, "")}`;
  return `${normalized}@c.us`;
}

export async function sendWhatsAppMessage(phoneOrChatId: string, message: string): Promise<void> {
  const chatId = phoneOrChatId.includes("@") ? phoneOrChatId : formatPhone(phoneOrChatId);
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

export type WhatsAppGroup = { id: string; name: string };

export async function getWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const res = await fetch(`${BASE()}/getChats/${TOKEN}`, { method: "GET" });
  if (!res.ok) throw new Error(`Green API getChats ${res.status}`);
  const data = await res.json() as { id?: string; name?: string; type?: string }[];
  return data
    .filter((c) => c.type === "group" && c.id && c.name)
    .map((c) => ({ id: c.id!, name: c.name! }));
}
