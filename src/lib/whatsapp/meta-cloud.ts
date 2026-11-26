const ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID!;
const API_VERSION = "v22.0";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("972") ? digits : `972${digits.replace(/^0/, "")}`;
}

type TemplateParameter =
  | { type: "text"; text: string; parameter_name?: string }
  | { type: "document"; document: { link: string; filename: string } };
export type TemplateMessage = {
  name: string;
  language: { code: string };
  components: { type: "header" | "body"; parameters: TemplateParameter[] }[];
};

async function sendTemplate(phone: string, template: TemplateMessage): Promise<void> {
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
      template,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta WhatsApp ${res.status}: ${text}`);
  }
}

// Messages sent through Meta's official API (approved templates only).
// Everything else (reminders, reports, scheduler, polls) stays on Green API
// (src/lib/whatsapp/greenapi.ts).

// "code_entry_app" Utility template: the OTP code is the header parameter,
// the body ("בהצלחה!") is static.
// See docs/superpowers/specs/2026-10-28-whatsapp-otp-meta-cutover-design.md.
export async function sendWhatsAppOtpTemplate(phone: string, code: string): Promise<void> {
  await sendTemplate(phone, {
    name: "code_entry_app",
    language: { code: "he" },
    components: [{ type: "header", parameters: [{ type: "text", text: code }] }],
  });
}

// "academy_event_followup" Marketing template, sent the day after an intro
// event. One named body variable, {{customer_name}}; the feedback button
// has a fixed URL, so it takes no parameter.
export function introFollowupTemplate(customerName: string): TemplateMessage {
  return {
    name: "academy_event_followup",
    language: { code: "he" },
    components: [
      {
        type: "body",
        parameters: [{ type: "text", parameter_name: "customer_name", text: customerName.trim() || "שחקן יקר" }],
      },
    ],
  };
}

export async function sendIntroFollowupTemplate(phone: string, customerName: string): Promise<void> {
  await sendTemplate(phone, introFollowupTemplate(customerName));
}

// "assessment_report" Utility template: the report PDF is the header
// document (Meta downloads it from the signed link), the body greets the
// player by name ({{customer_name}}). No buttons.
export function assessmentReportTemplate(customerName: string, pdfUrl: string, fileName: string): TemplateMessage {
  return {
    name: "assessment_report",
    language: { code: "he" },
    components: [
      { type: "header", parameters: [{ type: "document", document: { link: pdfUrl, filename: fileName } }] },
      {
        type: "body",
        parameters: [{ type: "text", parameter_name: "customer_name", text: customerName.trim() || "שחקן יקר" }],
      },
    ],
  };
}

export async function sendAssessmentReportTemplate(
  phone: string,
  customerName: string,
  pdfUrl: string,
  fileName: string,
): Promise<void> {
  await sendTemplate(phone, assessmentReportTemplate(customerName, pdfUrl, fileName));
}

// "payments_weekly_summary" Utility template, sent every Sunday to the
// academy's own number: the week, how many are overdue / due this week and
// the money expected. Its URL button (fixed) opens the payments tab.
export type PaymentsSummaryNumbers = { week: string; overdue: number; due: number; amount: number };

export function paymentsSummaryTemplate(n: PaymentsSummaryNumbers): TemplateMessage {
  return {
    name: "payments_weekly_summary",
    language: { code: "he" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "week", text: n.week },
          { type: "text", parameter_name: "overdue", text: String(n.overdue) },
          { type: "text", parameter_name: "due", text: String(n.due) },
          { type: "text", parameter_name: "amount", text: n.amount.toLocaleString("he-IL") },
        ],
      },
    ],
  };
}

export async function sendPaymentsSummaryTemplate(phone: string, n: PaymentsSummaryNumbers): Promise<void> {
  await sendTemplate(phone, paymentsSummaryTemplate(n));
}
