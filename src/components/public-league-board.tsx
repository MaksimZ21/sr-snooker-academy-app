"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DistrictPanel = {
  id: string;
  label: string;
  // This district's part of the schedule; null when none.
  schedule: React.ReactNode | null;
  standings: React.ReactNode;
  rounds: React.ReactNode | null;
};

type Tab = "schedule" | "standings" | "breaks" | "rounds";
type Panel = Tab;

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
export function PublicLeagueBoard({
  districts,
  breaks,
  schedule,
}: {
  districts: DistrictPanel[];
  breaks: React.ReactNode;
  // This week's and upcoming matches, all districts; null when none.
  schedule: React.ReactNode | null;
}) {
  const [districtId, setDistrictId] = useState(districts[0]?.id);
  const [tab, setTab] = useState<Tab>("standings");
  const district = districts.find((d) => d.id === districtId) ?? districts[0];
  // The schedule follows the district picked with the district buttons.
  const scheduleBody = district ? district.schedule : schedule;

  // Desktop only: each list can be folded away to cut the scrolling. The
  // long breaks list starts folded. On a phone the tabs already show one
  // list at a time, so folding is off there.
  const [folded, setFolded] = useState<Set<Panel>>(() => new Set<Panel>(["breaks"]));
  const toggle = (panel: Panel) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });

  const card = (panel: Panel, title: string, body: React.ReactNode) => {
    const isFolded = folded.has(panel);
    return (
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <p className="text-sm font-semibold px-4 pt-3 pb-2 md:hidden">{title}</p>
        <button
          type="button"
          onClick={() => toggle(panel)}
          aria-expanded={!isFolded}
          className="hidden md:flex w-full items-center justify-between gap-2 px-4 pt-3 pb-2 text-sm font-semibold hover:bg-muted/40"
        >
          {title}
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            {isFolded ? "הצג" : "הסתר"}
            <ChevronDown size={14} className={cn("transition-transform", !isFolded && "rotate-180")} />
          </span>
        </button>
        <div className={cn(isFolded && "md:hidden")}>{body}</div>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-muted p-1 md:hidden">
        {(
          [
            ["schedule", "לוז"],
            ["standings", "טבלת ליגה"],
            ["breaks", "ברייקים"],
            ["rounds", "תוצאות"],
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

      {districts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {districts.map((d) => (
            <Pill key={d.id} active={d.id === district?.id} onClick={() => setDistrictId(d.id)}>
              {d.label}
            </Pill>
          ))}
        </div>
      )}

      {/* Desktop: the schedule stays on top. Phone: it's one of the tabs. */}
      <div className={tab === "schedule" ? (schedule ? "block" : "block md:hidden") : schedule ? "hidden md:block" : "hidden"}>
        {card(
          "schedule",
          "לוז",
          <>
            <div key={district?.id ?? "all"}>
              {scheduleBody ?? <p className="py-4 text-center text-sm text-muted-foreground">אין משחקים מתוכננים</p>}
            </div>
          </>,
        )}
      </div>

      {/* Desktop: district table with its results right under it, breaks beside. */}
      <div className="grid gap-4 md:grid-cols-[3fr_2fr] md:items-start">
        <div className={cn("flex flex-col gap-4 min-w-0", tab !== "standings" && tab !== "rounds" && "hidden md:flex")}>
          <div className={cn(tab !== "standings" && "hidden md:block")}>
            {district
              ? card("standings", district.label, district.standings)
              : card("standings", "טבלת ליגה", <p className="py-6 text-center text-sm text-muted-foreground">הליגה טרם החלה</p>)}
          </div>
          {district && (
            <div className={cn(tab !== "rounds" && "hidden md:block")}>
              {card(
                "rounds",
                `תוצאות · ${district.label}`,
                district.rounds ?? <p className="pb-4 text-center text-sm text-muted-foreground">עדיין אין תוצאות</p>,
              )}
            </div>
          )}
        </div>
        <div className={cn("min-w-0", tab !== "breaks" && "hidden md:block")}>{card("breaks", "טבלת ברייקים", breaks)}</div>
      </div>
    </section>
  );
}
