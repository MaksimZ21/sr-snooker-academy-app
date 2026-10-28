# WhatsApp OTP: Cutover to Meta Cloud API Design Spec

Date: 2026-10-28

## Purpose

Login OTP delivery currently goes through Green API (unofficial WhatsApp client), via `sendWhatsAppMessage` in `src/lib/whatsapp/greenapi.ts`, called from `src/app/api/auth/whatsapp-otp/send/route.ts`. The academy has set up a Meta WhatsApp Business Cloud API account and gotten a message template (`code_entry_app`, Utility category, Hebrew) approved, as the first phase of a planned migration away from Green API. This spec covers only that first phase: a hard cutover of OTP delivery to Meta's official API. Every other Green API use (daily reminders, monthly reports, the admin free-text scheduler, polls) stays on Green API — those aren't template-based and have no Meta equivalent as currently designed; out of scope here, to be revisited separately.

## Approved Template

- Name: `code_entry_app`
- Category: Utility
- Language: Hebrew (Meta language code `he`)
- Header: `קוד הכניסה שלך למערכת האקדמיה: {{1}}` — one text parameter, the OTP code
- Body: `בהצלחה!` — static, no parameters

## New Module: `src/lib/whatsapp/meta-cloud.ts`

```ts
export async function sendWhatsAppOtpTemplate(phone: string, code: string): Promise<void>
```

- Formats `phone` to digits-only international form (`972XXXXXXXXX`) — same normalization Green API's `formatPhone` already does, minus the `@c.us` suffix (that's a Green-API-specific chat-id convention, not used by Meta's API).
- `POST https://graph.facebook.com/v22.0/{META_WHATSAPP_PHONE_NUMBER_ID}/messages`
- Headers: `Authorization: Bearer ${META_WHATSAPP_ACCESS_TOKEN}`, `Content-Type: application/json`
- Body:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "<formatted phone>",
    "type": "template",
    "template": {
      "name": "code_entry_app",
      "language": { "code": "he" },
      "components": [
        { "type": "header", "parameters": [{ "type": "text", "text": "<code>" }] }
      ]
    }
  }
  ```
- On a non-OK response, throws `Error` with status + response body text — same error-surfacing convention `greenapi.ts`'s functions already use (`Meta WhatsApp {status}: {text}`).
- No retry, no fallback to Green API — a thrown error propagates to the caller exactly like today's `sendWhatsAppMessage` does.

## New Env Vars

- `META_WHATSAPP_ACCESS_TOKEN` — permanent System User token
- `META_WHATSAPP_PHONE_NUMBER_ID` — the sending number's Phone Number ID

Both added to `.env.local.example` (empty placeholders, like every other secret there) and set in Vercel by the user.

## Wiring: `src/app/api/auth/whatsapp-otp/send/route.ts`

- Replace `import { sendWhatsAppMessage } from "@/lib/whatsapp/greenapi"` with `import { sendWhatsAppOtpTemplate } from "@/lib/whatsapp/meta-cloud"`.
- Replace the call:
  ```ts
  await sendWhatsAppMessage(local, `קוד הכניסה שלך לאקדמיית סנוקר: *${code}*\nתקף ל-10 דקות.`);
  ```
  with:
  ```ts
  await sendWhatsAppOtpTemplate(local, code);
  ```
  The free-text message string is deleted entirely — wording now lives in the Meta-approved template, not in this code. (The 10-minute validity is still true — `expiresAt` two lines above is unchanged — it's just no longer spelled out in the message text, since the template doesn't have that line. Not a functional change to the OTP's actual expiry.)
- Nothing else in this route changes: OTP generation, HMAC signing, the coach/student phone lookup, and the response shape are all untouched.

## Verification Plan (this agent cannot do this part)

No live Supabase connection or Meta credentials are available to the implementing agent, and this repo has no way to actually send a WhatsApp message from this sandbox. Verification is: `npx tsc --noEmit` passes, the code matches this spec, and — once the user has set both env vars in Vercel and deployed — an end-to-end login attempt from the real login page confirms a WhatsApp message actually arrives with the correct code.

## Explicitly Out of Scope

- `greenapi.ts` itself — unchanged, still used by every other WhatsApp feature.
- Any other Meta Cloud API message type (free text, other templates) — only this one template, only for OTP.
- Fallback/retry logic if the Meta send fails — hard cutover, explicitly decided against a fallback.
- Migrating any other WhatsApp feature (reminders, reports, scheduler, polls) to Meta.
