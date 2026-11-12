"use client";
import { useState } from "react";
import { LeagueBreaksTable } from "@/components/league-breaks-table";
import { BreaksSearchInput } from "@/components/breaks-search-input";
import type { BreakTableRow } from "@/lib/sheets/tournament-logic";

// The public breaks table with a name search. Takes plain data (not
// functions) so the server page can hand it over.
export function PublicBreaksPanel({
  rows,
  names,
  districts,
}: {
  rows: BreakTableRow[];
  names: Record<string, string>;
  districts: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <BreaksSearchInput value={query} onChange={setQuery} />
      <LeagueBreaksTable
        rows={rows}
        renderName={(id) => names[id] ?? "?"}
        nameText={(id) => names[id] ?? ""}
        query={query}
        districtOf={(id) => districts[id] ?? ""}
      />
    </>
  );
}
