"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

type DistrictPanel = { id: string; label: string; standings: React.ReactNode; rounds: React.ReactNode | null };
type Tab = "standings" | "breaks" | "rounds";

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Public league page body. Desktop: league table and breaks table side by
// side, the rounds underneath. Phone: one at a time, picked with buttons,
// instead of one long scroll. The panels are rendered on the server and
// handed in as nodes.
export function PublicLeagueBoard({ districts, breaks }: { districts: DistrictPanel[]; breaks: React.ReactNode }) {
  const [districtId, setDistrictId] = useState(districts[0]?.id);
  const [tab, setTab] = useState<Tab>("standings");
  const district = districts.find((d) => d.id === districtId) ?? districts[0];

  const card = (title: string, body: React.ReactNode) => (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <p className="text-sm font-semibold px-4 pt-3 pb-2">{title}</p>
      {body}
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      {districts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {districts.map((d) => (
            <Pill key={d.id} active={d.id === district?.id} onClick={() => setDistrictId(d.id)}>
              {d.label}
            </Pill>
          ))}
        </div>
      )}

      <div className="flex gap-1 rounded-xl bg-muted p-1 md:hidden">
        {(
          [
            ["standings", "טבלת ליגה"],
            ["breaks", "ברייקים"],
            ["rounds", "משחקים"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr_2fr] md:items-start">
        <div className={cn(tab !== "standings" && "hidden", "md:block min-w-0")}>
          {district ? card(district.label, district.standings) : card("טבלת ליגה", <p className="py-6 text-center text-sm text-muted-foreground">הליגה טרם החלה</p>)}
        </div>
        <div className={cn(tab !== "breaks" && "hidden", "md:block min-w-0")}>{card("טבלת ברייקים", breaks)}</div>
      </div>

      {district?.rounds && (
        <div className={cn(tab !== "rounds" && "hidden", "md:block")}>{card(`משחקים · ${district.label}`, district.rounds)}</div>
      )}
    </section>
  );
}
