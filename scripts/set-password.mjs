import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.split("=").map((s) => s.trim())),
);

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];

if (!EMAIL || !PASSWORD) {
  console.error("Usage: node scripts/set-password.mjs <email> <password>");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
if (listError) { console.error(listError.message); process.exit(1); }

const user = users.find((u) => u.email === EMAIL);
if (!user) { console.error(`User not found: ${EMAIL}`); process.exit(1); }

const { error } = await admin.auth.admin.updateUserById(user.id, { password: PASSWORD });
if (error) { console.error(error.message); process.exit(1); }

console.log(`✓ Password updated for ${EMAIL}`);
