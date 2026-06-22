// One-off script: import coaches into Supabase (coaches table + auth user, no invite email)
// Usage: node scripts/import-coaches.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_KEY };
  }
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const vars = Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => { const [k, ...rest] = l.split("="); return [k.trim(), rest.join("=").trim()]; }),
    );
    return { url: vars.NEXT_PUBLIC_SUPABASE_URL, key: vars.SUPABASE_SERVICE_ROLE_KEY };
  } catch {
    console.error(
      "ERROR: No .env.local found. Run with env vars:\n" +
      "  $env:SUPABASE_URL='https://xxx.supabase.co'; $env:SUPABASE_KEY='service_role_key'; node scripts/import-coaches.mjs"
    );
    process.exit(1);
  }
}

const { url, key } = loadEnv();
const supabase = createClient(url, key);

const COACHES = [
  { email: "amir.zietman@gmail.com",  name: "אמיר זיטמן",    phone: "0556634478" },
  { email: "karin19975@gmail.com",    name: "קרין פולונסקי", phone: "0525163513" },
  { email: "aviarpal@gmail.com",      name: "אבי שוקרון",    phone: "0528551414" },
  { email: "vikshim@gmail.com",       name: "ויקטור שימנסקי", phone: "0545224571" },
  { email: "munir1abr@gmail.com",     name: "מוניר אבו רוקן", phone: "0546930424" },
  { email: "djsaharlevi@gmail.com",   name: "סהר לוי",        phone: "0535700970" },
  { email: "noaehome@gmail.com",      name: "נועה אנג'ל",    phone: "0506660684" },
  { email: "asafts@gmail.com",        name: "אסף ציקלג",     phone: "0525092183" },
  { email: "ofer.hm@gmail.com",       name: "עופר חיים",     phone: "0523280123" },
];

async function main() {
  console.log(`Importing ${COACHES.length} coaches...\n`);

  for (const coach of COACHES) {
    const email = coach.email.trim().toLowerCase();

    // Upsert into coaches table
    const { error: dbError } = await supabase
      .from("coaches")
      .upsert({ email, name: coach.name, phone: coach.phone, active: true }, { onConflict: "email" });

    if (dbError) {
      console.error(`  DB ERROR [${email}]: ${dbError.message}`);
      continue;
    }

    // Create auth user without sending any email
    const { error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    const alreadyExists = authError?.message?.toLowerCase().includes("already");
    if (authError && !alreadyExists) {
      console.error(`  AUTH ERROR [${email}]: ${authError.message}`);
    } else {
      console.log(`  OK  ${coach.name} <${email}>${alreadyExists ? " (auth user existed)" : ""}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
