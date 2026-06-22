// One-off script: import students from CSV files into Supabase
// Usage: node scripts/import-college-students.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env: try process.env first, then .env.local
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
    console.error("ERROR: No .env.local found. Run with:\n  $env:SUPABASE_URL='...'; $env:SUPABASE_KEY='...'; node scripts/import-college-students.mjs");
    process.exit(1);
  }
}
const { url, key } = loadEnv();
const supabase = createClient(url, key);

// CSV files and their college/group mapping
const FILES = [
  { path: "C:/Users/user/Downloads/חיפה.csv",         college: "חיפה",       group: "חיפה" },
  { path: "C:/Users/user/Downloads/אשדוד.csv",        college: "אשדוד",      group: "אשדוד" },
  { path: "C:/Users/user/Downloads/פתח תקווה.csv",    college: "פתח תקווה", group: "פתח תקווה" },
  { path: "C:/Users/user/Downloads/כפר סבא א.csv",    college: "כפר סבא",   group: "כפר סבא א" },
  { path: "C:/Users/user/Downloads/כפר סבא ב.csv",    college: "כפר סבא",   group: "כפר סבא ב" },
  { path: "C:/Users/user/Downloads/תל אביב.csv",      college: "תל אביב",   group: "תל אביב" },
];

function parseName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  const last = parts.pop();
  return { first_name: parts.join(" "), last_name: last };
}

function parseCSV(filePath) {
  const content = readFileSync(filePath, "utf8").replace(/^﻿/, ""); // strip BOM
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  // skip header
  return lines.slice(1).map((line) => {
    // handle quoted fields
    const fields = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { fields.push(cur); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur);
    const name = fields[0]?.trim() ?? "";
    const email = fields[3]?.trim();
    return { name, email: email && email !== "-" ? email.toLowerCase() : "" };
  }).filter((r) => r.name);
}

async function nextStudentId() {
  const { data } = await supabase.from("students").select("id");
  const nums = (data ?? [])
    .map((r) => { const m = r.id.match(/^S(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
    .filter((n) => n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

async function nextGroupId() {
  const { data } = await supabase.from("groups").select("id");
  const nums = (data ?? [])
    .map((r) => { const m = r.id.match(/^GRP-(\d+)$/); return m ? parseInt(m[1], 10) : 0; })
    .filter((n) => n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

async function main() {
  // Fetch existing students to detect duplicates by email
  const { data: existing } = await supabase.from("students").select("id, email");
  const emailToId = new Map(
    (existing ?? []).filter((s) => s.email).map((s) => [s.email.toLowerCase(), s.id]),
  );

  let idCounter = await nextStudentId();
  let grpCounter = await nextGroupId();

  // Map group name → list of inserted student IDs
  const groupStudentIds = new Map();

  for (const file of FILES) {
    console.log(`\nProcessing ${file.group}...`);
    const rows = parseCSV(file.path);
    const studentIds = [];

    for (const row of rows) {
      // Deduplicate by email
      if (row.email && emailToId.has(row.email)) {
        const existingId = emailToId.get(row.email);
        console.log(`  SKIP (exists): ${row.name} <${row.email}> → ${existingId}`);
        studentIds.push(existingId);
        continue;
      }

      const { first_name, last_name } = parseName(row.name);
      const id = `S${String(idCounter).padStart(3, "0")}`;
      idCounter++;

      const { error } = await supabase.from("students").insert({
        id,
        first_name,
        last_name,
        phone: "",
        email: row.email,
        college_name: file.college,
        subscription_type: "",
        general_notes: "",
        active: true,
      });

      if (error) {
        console.error(`  ERROR inserting ${row.name}:`, error.message);
      } else {
        console.log(`  INSERT: ${id} — ${first_name} ${last_name} <${row.email || "no email"}>`);
        if (row.email) emailToId.set(row.email, id);
        studentIds.push(id);
      }
    }

    groupStudentIds.set(file.group, { college: file.college, ids: studentIds });
  }

  // Create/update groups
  console.log("\nCreating groups...");
  const { data: existingGroups } = await supabase.from("groups").select("id, name");
  const groupNameToId = new Map((existingGroups ?? []).map((g) => [g.name, g.id]));

  for (const [groupName, { college, ids }] of groupStudentIds) {
    const uniqueIds = [...new Set(ids)];
    if (groupNameToId.has(groupName)) {
      const gid = groupNameToId.get(groupName);
      // Merge with existing student_ids
      const { data: existing } = await supabase.from("groups").select("student_ids").eq("id", gid).single();
      const merged = [...new Set([...(existing?.student_ids ?? []), ...uniqueIds])];
      await supabase.from("groups").update({ student_ids: merged, college_name: college }).eq("id", gid);
      console.log(`  UPDATE group "${groupName}" (${gid}): ${merged.length} students`);
    } else {
      const gid = `GRP-${String(grpCounter).padStart(3, "0")}`;
      grpCounter++;
      await supabase.from("groups").insert({ id: gid, name: groupName, student_ids: uniqueIds, college_name: college });
      console.log(`  CREATE group "${groupName}" (${gid}): ${uniqueIds.length} students`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
