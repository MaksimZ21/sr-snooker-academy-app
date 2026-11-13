import { db } from "@/lib/db/client";
import { SKILL_LEVELS, SKILL_LEVELS_9FT, type TableSize } from "./schemas";

// The level lists (best first), editable on the settings page.
export type SkillLevelLists = Record<TableSize, string[]>;
export type SkillLevelEntry = { id: string; table_size: TableSize; label: string; position: number };

export async function fetchSkillLevelEntries(): Promise<SkillLevelEntry[]> {
  const { data, error } = await db.from("skill_levels").select("id, table_size, label, position").order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillLevelEntry[];
}

// Falls back to the built-in lists if the table is empty or missing, so a
// player's level never becomes unreadable.
export async function fetchSkillLevels(): Promise<SkillLevelLists> {
  let entries: SkillLevelEntry[] = [];
  try {
    entries = await fetchSkillLevelEntries();
  } catch {
    entries = [];
  }
  const twelve = entries.filter((e) => e.table_size === "12").map((e) => e.label);
  const nine = entries.filter((e) => e.table_size === "9-10").map((e) => e.label);
  return {
    "12": twelve.length ? twelve : [...SKILL_LEVELS],
    "9-10": nine.length ? nine : [...SKILL_LEVELS_9FT],
  };
}

export async function assertValidLevel(size: TableSize, label: string | null | undefined): Promise<void> {
  if (label === null || label === undefined) return;
  const lists = await fetchSkillLevels();
  if (!lists[size].includes(label)) throw new Error(`הדרגה ${label} לא קיימת ברשימת ${size} פיט`);
}

function columnFor(size: TableSize) {
  return size === "9-10" ? "skill_level_9ft" : "skill_level";
}

export async function addSkillLevel(size: TableSize, label: string): Promise<void> {
  const clean = label.trim();
  if (!clean) throw new Error("חסר שם לדרגה");
  const entries = (await fetchSkillLevelEntries()).filter((e) => e.table_size === size);
  if (entries.some((e) => e.label === clean)) throw new Error("הדרגה כבר קיימת");
  const position = entries.length ? Math.max(...entries.map((e) => e.position)) + 1 : 0;
  const { error } = await db.from("skill_levels").insert({ table_size: size, label: clean, position });
  if (error) throw new Error(error.message);
}

// Renaming carries every player (and the handicap table, for 12 ft) over to
// the new name.
export async function renameSkillLevel(id: string, label: string): Promise<void> {
  const clean = label.trim();
  if (!clean) throw new Error("חסר שם לדרגה");
  const entries = await fetchSkillLevelEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error("הדרגה לא נמצאה");
  if (entry.label === clean) return;
  if (entries.some((e) => e.table_size === entry.table_size && e.label === clean)) throw new Error("הדרגה כבר קיימת");

  const { error } = await db.from("skill_levels").update({ label: clean }).eq("id", id);
  if (error) throw new Error(error.message);

  // A rename isn't a level change: put back the 12 ft change stamp the DB
  // trigger would otherwise reset (that would restart the players' count).
  const { data: holders } = await db
    .from("students")
    .select("id, skill_level_changed_at")
    .eq(columnFor(entry.table_size), entry.label);
  const { error: sErr } = await db
    .from("students")
    .update({ [columnFor(entry.table_size)]: clean })
    .eq(columnFor(entry.table_size), entry.label);
  if (sErr) throw new Error(sErr.message);
  if (entry.table_size === "12") {
    for (const h of (holders ?? []) as { id: string; skill_level_changed_at: string | null }[]) {
      await db.from("students").update({ skill_level_changed_at: h.skill_level_changed_at }).eq("id", h.id);
    }
    await db.from("handicap_values").update({ level_label: clean }).eq("level_label", entry.label);
    await db.from("league_matches").update({ level_a: clean }).eq("level_a", entry.label);
    await db.from("league_matches").update({ level_b: clean }).eq("level_b", entry.label);
  }
}

// A level still held by players can't be removed — they'd be left with a
// level that doesn't exist.
export async function deleteSkillLevel(id: string): Promise<void> {
  const entries = await fetchSkillLevelEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error("הדרגה לא נמצאה");
  const { count } = await db
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq(columnFor(entry.table_size), entry.label);
  if (count) throw new Error(`יש ${count} שחקנים בדרגה ${entry.label}. קודם תעביר אותם לדרגה אחרת`);
  const { error } = await db.from("skill_levels").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (entry.table_size === "12") await db.from("handicap_values").delete().eq("level_label", entry.label);
}

// Moves a level one place up (stronger) or down (weaker) in its list.
export async function moveSkillLevel(id: string, direction: "up" | "down"): Promise<void> {
  const all = await fetchSkillLevelEntries();
  const entry = all.find((e) => e.id === id);
  if (!entry) throw new Error("הדרגה לא נמצאה");
  const list = all.filter((e) => e.table_size === entry.table_size);
  const i = list.findIndex((e) => e.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].position === k) continue;
    const { error } = await db.from("skill_levels").update({ position: k }).eq("id", list[k].id);
    if (error) throw new Error(error.message);
  }
}
