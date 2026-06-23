/**
 * Seed test sessions for a coach.
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=<service_role_key> node scripts/seed-test-sessions.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY env vars");
  process.exit(1);
}

const db = createClient(url, key);

// ── Config ────────────────────────────────────────────────────
const COACH_EMAIL = "maksim110044@gmail.com"; // change if needed
const MONTH = "2025-06"; // YYYY-MM

const sessions = [
  { date: `${MONTH}-02`, training_type: "private",    source: "מכללה",        price_nis: 250, start_time: "09:00", end_time: "10:00" },
  { date: `${MONTH}-02`, training_type: "group",      source: "מכללה",        price_nis: 150, start_time: "11:00", end_time: "12:00" },
  { date: `${MONTH}-05`, training_type: "private",    source: "אחר",          price_nis: 250, start_time: "10:00", end_time: "11:00" },
  { date: `${MONTH}-09`, training_type: "beginners",  source: "מכללה",        price_nis: 180, start_time: "09:00", end_time: "10:30" },
  { date: `${MONTH}-09`, training_type: "group",      source: "מכללה",        price_nis: 150, start_time: "11:00", end_time: "12:00" },
  { date: `${MONTH}-12`, training_type: "private",    source: "אירוע הכרות", price_nis: 200, start_time: "14:00", end_time: "15:00" },
  { date: `${MONTH}-16`, training_type: "match-play", source: "מכללה",        price_nis: 200, start_time: "09:00", end_time: "10:30" },
  { date: `${MONTH}-18`, training_type: "private",    source: "אחר",          price_nis: 250, start_time: "10:00", end_time: "11:00" },
  { date: `${MONTH}-23`, training_type: "technique",  source: "מכללה",        price_nis: 180, start_time: "09:00", end_time: "10:00" },
  { date: `${MONTH}-23`, training_type: "private",    source: "מכללה",        price_nis: 250, start_time: "11:00", end_time: "12:00" },
];

const rows = sessions.map((s) => ({
  coach_email: COACH_EMAIL,
  status: "completed",
  student_ids: [],
  ...s,
}));

const { data, error } = await db.from("sessions").insert(rows).select("id");
if (error) {
  console.error("Insert failed:", error.message);
  process.exit(1);
}
console.log(`✅ Inserted ${data.length} sessions for ${COACH_EMAIL} in ${MONTH}`);
