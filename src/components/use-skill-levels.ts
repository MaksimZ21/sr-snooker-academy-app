"use client";
import { useQuery } from "@tanstack/react-query";
import { SKILL_LEVELS, SKILL_LEVELS_9FT, type TableSize } from "@/lib/sheets/schemas";
import type { SkillLevelEntry } from "@/lib/sheets/skill-levels";

export const SKILL_LEVELS_QUERY_KEY = ["settings", "skill-levels"];

// The level lists from the settings page, best first. Until they load (or
// if the request fails) the built-in lists are used.
export function useSkillLevels() {
  const { data } = useQuery({
    queryKey: SKILL_LEVELS_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/levels");
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { entries: SkillLevelEntry[] };
    },
    staleTime: 5 * 60_000,
  });
  const entries = data?.entries ?? [];
  const twelve = entries.filter((e) => e.table_size === "12").map((e) => e.label);
  const nine = entries.filter((e) => e.table_size === "9-10").map((e) => e.label);
  const lists: Record<TableSize, string[]> = {
    "12": twelve.length ? twelve : [...SKILL_LEVELS],
    "9-10": nine.length ? nine : [...SKILL_LEVELS_9FT],
  };
  return {
    entries,
    lists,
    levelsFor: (size: TableSize | null | undefined) => (size === "9-10" ? lists["9-10"] : lists["12"]),
  };
}
