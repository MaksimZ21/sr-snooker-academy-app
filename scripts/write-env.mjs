import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const KEY_PATH = resolve(ROOT, "snooker-academy-494906-56e89d932e6e.json");
const ENV_PATH = resolve(ROOT, ".env.local");

if (existsSync(ENV_PATH)) {
  console.error("Refusing to overwrite existing .env.local. Delete it first if you want to regenerate.");
  process.exit(1);
}

const sa = readFileSync(KEY_PATH, "utf8");
const oneLine = JSON.stringify(JSON.parse(sa));

const env = `NEXT_PUBLIC_SUPABASE_URL=https://okfkwjirbhsiykpixsro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZmt3amlyYmhzaXlrcGl4c3JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MDE1NzEsImV4cCI6MjA5MzA3NzU3MX0.2VwbIUqKwy0d5ALltFbjwVlIGYqNLvdNh8PyOrF6N78
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_JSON=${oneLine}
GOOGLE_SHEET_ID=1uST7mmpMMAQQwxTg5N3BGH-brOGxY7-ey2wnGIG_PV4
GOOGLE_SHEET_ID_TEST=1uST7mmpMMAQQwxTg5N3BGH-brOGxY7-ey2wnGIG_PV4
ADMIN_EMAILS=lior15250@gmail.com
`;

writeFileSync(ENV_PATH, env, "utf8");
console.log(`Wrote ${ENV_PATH}`);
console.log(`GOOGLE_SERVICE_ACCOUNT_JSON length: ${oneLine.length} chars`);
