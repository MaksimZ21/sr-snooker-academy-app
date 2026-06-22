// node scripts/gen-sessions-sql.mjs
import { readFileSync, writeFileSync } from 'fs';

const emailMap = {
  'אסף ציקלג': 'asafts@gmail.com',
  'ויקטור שימנסקי': 'vikshim@gmail.com',
  'נועה אנג\'ל': 'noaehome@gmail.com',
  'עופר חיים': 'ofer.hm@gmail.com',
  'אבי שוקרון': 'aviarpal@gmail.com',
  'מוניר אבו רוקין': 'munir1abr@gmail.com',
  'קרין פולונסקי': 'karin19975@gmail.com',
  'אמיר זיטמן': 'amir.zietman@gmail.com',
};

// Hebrew names (for display in output)
const nameFor = Object.fromEntries(Object.entries(emailMap).map(([k,v])=>[v,k]));

const csvPath = 'C:/Users/user/Downloads/הכנסת אימונים למערכת - גיליון1.csv';
const outPath = 'C:/Users/user/Downloads/import-sessions-v2.sql';

let raw;
try {
  raw = readFileSync(csvPath, 'utf8');
} catch (e) {
  console.error('File not found:', csvPath);
  process.exit(1);
}

const lines = raw.split(/\r?\n/);
const inserts = [];
const skipped = {};

for (const line of lines) {
  if (!line.trim()) continue;

  let cols = line.split('\t');
  if (cols.length < 5) cols = line.split(',');
  if (cols.length < 5) continue;

  const coachName = cols[0].trim();
  const dateStr   = cols[1].trim();
  const source    = cols[3].trim();
  const location  = cols[4].trim();

  // Price = last numeric column
  let priceNis = 0;
  for (let i = cols.length - 1; i >= 5; i--) {
    if (/^\d+$/.test(cols[i].trim())) {
      priceNis = parseInt(cols[i].trim(), 10);
      break;
    }
  }

  if (!coachName || !/\d/.test(dateStr)) continue;

  const email = emailMap[coachName];
  if (!email) {
    skipped[coachName] = (skipped[coachName] || 0) + 1;
    continue;
  }

  // DD/MM/YYYY -> YYYY-MM-DD
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) continue;
  const sqlDate = `${m[3]}-${m[2]}-${m[1]}`;

  const trainingType = location.startsWith('G1') ? 'group' : 'private';
  const locEsc = location.replace(/'/g, "''");
  const srcEsc = source.replace(/'/g, "''");

  inserts.push(
    `  (gen_random_uuid(), '${sqlDate}', '', '', '${email}', '${trainingType}', 'completed', ${priceNis}, '${srcEsc}', '${locEsc}')`
  );
}

if (inserts.length === 0) {
  console.error('No rows generated. Check file path and format.');
  process.exit(1);
}

const sql =
  'INSERT INTO sessions (id, date, start_time, end_time, coach_email, training_type, status, price_nis, source, name)\nVALUES\n' +
  inserts.join(',\n') + ';';

writeFileSync(outPath, sql, 'utf8');
console.log(`OK: ${inserts.length} rows -> ${outPath}`);

if (Object.keys(skipped).length) {
  console.log('\nSkipped:');
  for (const [name, cnt] of Object.entries(skipped).sort())
    console.log(`  - ${name} (${cnt} sessions)`);
}
