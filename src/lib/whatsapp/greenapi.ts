const INSTANCE_ID = process.env.GREENAPI_INSTANCE_ID!;
const TOKEN = process.env.GREENAPI_TOKEN!;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("972") ? digits : `972${digits.replace(/^0/, "")}`;
  return `${normalized}@c.us`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  const chatId = formatPhone(phone);
  const url = `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Green API ${res.status}: ${text}`);
  }
}
