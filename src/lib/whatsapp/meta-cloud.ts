const ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;
const API_VERSION = "v22.0";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("972") ? digits : `972${digits.replace(/^0/, "")}`;
}

// Sends the Meta-approved "code_entry_app" Utility template — the OTP code
// is the template's header parameter, the body ("בהצלחה!") is static with
// no parameters. See docs/superpowers/specs/2026-10-28-whatsapp-otp-meta-cutover-design.md.
// This is the only Meta Cloud API message this app sends — every other
// WhatsApp feature (reminders, reports, scheduler, polls) stays on Green
// API (src/lib/whatsapp/greenapi.ts) for now.
export async function sendWhatsAppOtpTemplate(phone: string, code: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formatPhone(phone),
      type: "template",
      template: {
        name: "code_entry_app",
        language: { code: "he" },
        components: [
          { type: "header", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta WhatsApp ${res.status}: ${text}`);
  }
}
