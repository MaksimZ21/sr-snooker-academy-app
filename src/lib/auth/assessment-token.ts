import { createHmac } from "crypto";

const SECRET = () => process.env.OTP_SECRET ?? "dev-secret";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function signAssessmentToken(assessmentId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${assessmentId}:${exp}`;
  const sig = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyAssessmentToken(token: string, assessmentId: string): boolean {
  try {
    const dot = token.indexOf(".");
    if (dot === -1) return false;
    const exp = Number(token.slice(0, dot));
    if (isNaN(exp) || Date.now() > exp) return false;
    const sig = token.slice(dot + 1);
    const payload = `${assessmentId}:${exp}`;
    const expected = createHmac("sha256", SECRET()).update(payload).digest("base64url");
    return sig === expected;
  } catch {
    return false;
  }
}
