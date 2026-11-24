import { cn } from "@/lib/utils";

// The handicap ("פור") tables between levels, shown on the public page of a
// multi-location tournament. Fixed values supplied by the organisers.

const THREE_REDS: [string, string][] = [
  ["A+", "+13"],
  ["A", "+10"],
  ["B", "+7"],
  ["C", "+4"],
  ["D", "+1"],
];

const LEVELS = ["A++", "A+", "A", "B", "C", "D", "E"] as const;

// Row = the player's level, column = the opponent's level.
const SIX_REDS: number[][] = [
  [0, -4, -10, -13, -20, -22, -26],
  [4, 0, -6, -9, -16, -18, -22],
  [10, 6, 0, -6, -9, -12, -16],
  [13, 9, 6, 0, -5, -9, -13],
  [20, 16, 9, 5, 0, -4, -8],
  [22, 18, 12, 9, 4, 0, -4],
  [26, 22, 16, 13, 8, 4, 0],
];

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function TournamentHandicapTables() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="bc-num text-2xl md:text-3xl">טבלת פורים בין הרמות</h2>

      <div className="rounded-[18px] border bg-card overflow-hidden max-w-sm">
        <p className="px-4 py-2.5 font-display text-sm font-extrabold">3 אדומים</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sidebar text-white/80 text-xs">
              <th className="px-4 py-2 text-right font-display font-bold">דירוג רמה לפי הסיווג</th>
              <th className="px-4 py-2 text-center font-display font-bold">פור</th>
            </tr>
          </thead>
          <tbody>
            {THREE_REDS.map(([level, points], i) => (
              <tr key={level} className={cn("border-t border-border/40", i % 2 === 1 && "bg-muted/25")}>
                <td className="px-4 py-2 font-display font-extrabold" dir="ltr" style={{ textAlign: "right" }}>
                  {level}
                </td>
                <td className="px-4 py-2 text-center bc-num text-base" dir="ltr">
                  {points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-[18px] border bg-card overflow-hidden">
        <p className="px-4 py-2.5 font-display text-sm font-extrabold">6 אדומים</p>
        <p className="px-4 pb-2 text-xs text-muted-foreground">שורה: הרמה שלך · עמודה: הרמה של היריב</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar text-white/80 text-xs">
                <th className="px-3 py-2 text-right font-display font-bold">רמה</th>
                {LEVELS.map((l) => (
                  <th key={l} className="px-2 py-2 text-center font-display font-bold" dir="ltr">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIX_REDS.map((row, r) => (
                <tr key={LEVELS[r]} className={cn("border-t border-border/40", r % 2 === 1 && "bg-muted/25")}>
                  <td className="px-3 py-2 font-display font-extrabold" dir="ltr" style={{ textAlign: "right" }}>
                    {LEVELS[r]}
                  </td>
                  {row.map((n, c) => (
                    <td
                      key={c}
                      dir="ltr"
                      className={cn(
                        "px-2 py-2 text-center tabular-nums font-semibold",
                        n === 0 && "text-muted-foreground",
                        n > 0 && "text-primary",
                      )}
                    >
                      {signed(n)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
