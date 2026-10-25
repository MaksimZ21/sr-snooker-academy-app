// Canonical local format (0XXXXXXXXX) a phone number is stored in, so every
// lookup that normalizes its OWN input the same way (WhatsApp OTP login,
// CRM phone matching, etc. — see their own inline copies of this logic)
// can find it with a plain equality match. Without normalizing at write
// time too, a number typed with dashes/spaces/a "+972" prefix gets stored
// verbatim and silently never matches again.
export function normalizePhoneLocal(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const core = digits.startsWith("972") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return `0${core}`;
}
