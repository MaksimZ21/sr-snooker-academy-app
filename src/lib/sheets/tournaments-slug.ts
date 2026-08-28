import { randomBytes } from "crypto";

// URL-safe, ~12-character unguessable slug — used for both tournament and
// player public links (/t/[slug], /p/[slug]). Not a sequential id: anyone
// with the link can view the page, so it must not be enumerable.
export function generatePublicSlug(): string {
  return randomBytes(9).toString("base64url");
}
