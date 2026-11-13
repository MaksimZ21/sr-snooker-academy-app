import { db } from "@/lib/db/client";

// The handicap ("פור") table: per district, points per frame for each 12 ft
// level. Between two players the weaker one gets the difference.
export type HandicapDistrict = { id: string; name: string; values: Record<string, number> };

export async function fetchHandicapDistricts(): Promise<HandicapDistrict[]> {
  const [{ data: districts, error }, { data: values }] = await Promise.all([
    db.from("handicap_districts").select("id, name, position").order("position").order("created_at"),
    db.from("handicap_values").select("district_id, level_label, points"),
  ]);
  if (error) throw new Error(error.message);
  const rows = (values ?? []) as { district_id: string; level_label: string; points: number }[];
  return ((districts ?? []) as { id: string; name: string }[]).map((d) => ({
    id: d.id,
    name: d.name,
    values: Object.fromEntries(
      rows.filter((v) => v.district_id === d.id).map((v) => [v.level_label, Number(v.points)]),
    ),
  }));
}

export async function addHandicapDistrict(name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("חסר שם מחוז");
  const { data: existing } = await db.from("handicap_districts").select("position");
  const position = Math.max(-1, ...((existing ?? []) as { position: number }[]).map((r) => r.position)) + 1;
  const { error } = await db.from("handicap_districts").insert({ name: clean, position });
  if (error) throw new Error(error.code === "23505" ? "המחוז כבר קיים" : error.message);
}

export async function renameHandicapDistrict(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("חסר שם מחוז");
  const { error } = await db.from("handicap_districts").update({ name: clean }).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "המחוז כבר קיים" : error.message);
}

export async function deleteHandicapDistrict(id: string): Promise<void> {
  const { error } = await db.from("handicap_districts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// points null clears the level's number in that district.
export async function setHandicapValue(districtId: string, level: string, points: number | null): Promise<void> {
  if (points === null) {
    const { error } = await db
      .from("handicap_values")
      .delete()
      .eq("district_id", districtId)
      .eq("level_label", level);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db
    .from("handicap_values")
    .upsert({ district_id: districtId, level_label: level, points }, { onConflict: "district_id,level_label" });
  if (error) throw new Error(error.message);
}
