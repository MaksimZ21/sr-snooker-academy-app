import { cn } from "@/lib/utils";

// One match like a TV scoreboard: each player on a line with their frames
// at the end; the winner's line lit, the loser's dimmed. `scoreA`/`scoreB`
// replace the score boxes (the admin puts result inputs there).
export function MatchLine({
  nameA,
  nameB,
  framesA,
  framesB,
  sub,
  scoreA,
  scoreB,
  aside,
}: {
  nameA: string;
  nameB: string;
  framesA: number | null;
  framesB: number | null;
  // Small line under the players (district, table…).
  sub?: string;
  scoreA?: React.ReactNode;
  scoreB?: React.ReactNode;
  // Something beside the sub line (e.g. a remove button).
  aside?: React.ReactNode;
}) {
  const played = framesA !== null && framesB !== null;
  const aWon = played && (framesA as number) > (framesB as number);
  const bWon = played && (framesB as number) > (framesA as number);
  const line = (name: string, frames: number | null, won: boolean, lost: boolean, custom?: React.ReactNode) => (
    <div className={cn("flex items-center justify-between gap-2 px-2.5 py-1.5", won && "bg-primary/8")}>
      <span className={cn("min-w-0 truncate text-[13px]", won ? "font-extrabold" : lost ? "text-muted-foreground" : "font-semibold")}>{name}</span>
      {custom ?? (
        <span
          className={cn(
            "shrink-0 min-w-7 text-center rounded-md px-1.5 py-0.5 bc-num text-sm leading-none",
            won ? "bg-primary text-white" : played ? "bg-muted text-muted-foreground" : "text-muted-foreground",
          )}
        >
          {played ? frames : "–"}
        </span>
      )}
    </div>
  );
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {line(nameA, framesA, aWon, bWon, scoreA)}
      <div className="h-px bg-border/60" />
      {line(nameB, framesB, bWon, aWon, scoreB)}
      {(sub || aside || !played) && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-muted/40 text-[11px] text-muted-foreground">
          <span className="truncate">{sub}</span>
          {aside ?? (!played && <span className="font-display font-bold shrink-0">טרם שוחק</span>)}
        </div>
      )}
    </div>
  );
}
