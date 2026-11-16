import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreakTableRow } from "@/lib/sheets/tournament-logic";

// A break's chip: 100+ (a century) in gold, 50+ in green, the rest plain.
function breakTone(value: number, best: boolean) {
  if (value >= 100) return "bg-[#f2b705] text-black";
  if (value >= 50) return best ? "bg-primary text-white" : "bg-primary/15 text-primary";
  return best ? "bg-sidebar text-white" : "bg-muted text-foreground";
}

// Shared by the admin and public league pages. No hooks, so it renders on
// the server too; onDelete and renderAdd are only passed on the admin page.
// Laid out like the league table: a dark header, the place in a box, the
// best break as the loud column and the rest as chips. Above it, the
// league's highest break gets its own line.
export function LeagueBreaksTable({
  rows,
  renderName,
  districtOf,
  onDelete,
  deleting,
  renderAdd,
  query = "",
  nameText,
}: {
  rows: BreakTableRow[];
  // Name search: rows whose nameText doesn't contain the query are hidden;
  // places stay those of the full table.
  query?: string;
  nameText?: (participantId: string) => string;
  renderName: (participantId: string) => React.ReactNode;
  districtOf: (participantId: string) => string;
  onDelete?: (breakId: string) => void;
  deleting?: boolean;
  renderAdd?: (participantId: string) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">אין שחקנים בליגה</p>;
  }
  const q = query.trim().toLowerCase();
  const visible = rows
    .map((row, i) => ({ row, place: i + 1 }))
    .filter(({ row }) => !q || !nameText || nameText(row.participantId).toLowerCase().includes(q));
  const top = rows[0]?.breaks[0] ? rows[0] : null;
  const total = rows.reduce((n, r) => n + r.breaks.length, 0);
  return (
    <div className="flex flex-col">
      {top && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-brand-gradient text-white px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-xs font-bold text-white/70">הברייק הגבוה בליגה</p>
            <p className="font-display text-base font-extrabold truncate">{renderName(top.participantId)}</p>
          </div>
          <div className="text-center shrink-0">
            <p className="bc-num text-4xl leading-none">{top.breaks[0].value}</p>
            <p className="text-[11px] text-white/70 mt-0.5">{total} ברייקים בליגה</p>
          </div>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">לא נמצא שחקן בשם הזה</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] md:text-sm">
            <thead>
              <tr className="bg-sidebar text-white/75 text-[11px] md:text-xs">
                <th className="text-center ps-2 md:ps-4 pe-1 py-2.5 font-display font-bold w-10">#</th>
                <th className="text-right px-2 py-2.5 font-display font-bold">שחקן</th>
                <th className="text-center px-2 py-2.5 font-display font-extrabold bg-primary text-white w-16">שיא</th>
                <th className="text-right px-2 py-2.5 font-display font-bold">ברייקים</th>
                {renderAdd && <th className="text-right px-4 py-2.5 font-display font-bold">הוספה</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, place }, i) => {
                const best = row.breaks[0]?.value;
                const rest = row.breaks.slice(1);
                return (
                  <tr key={row.participantId} className={cn("border-b border-border/40 last:border-b-0", i % 2 === 1 && "bg-muted/25")}>
                    <td className="ps-2 md:ps-4 pe-1 py-2 text-center">
                      {best !== undefined && (
                        <span
                          className={cn(
                            "inline-flex w-7 h-7 items-center justify-center rounded-md bc-num text-sm",
                            place === 1 ? "bg-primary text-white" : place <= 3 ? "bg-sidebar text-white" : "text-muted-foreground",
                          )}
                        >
                          {place}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="block font-semibold whitespace-nowrap">{renderName(row.participantId)}</span>
                      {districtOf(row.participantId) && (
                        <span className="block text-[11px] text-muted-foreground">{districtOf(row.participantId)}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center bg-primary/8">
                      {best !== undefined ? (
                        <span className={cn("inline-flex items-center gap-1", best >= 100 && "text-[#b98a00] dark:text-[#f2b705]")}>
                          <span className="bc-num text-lg md:text-xl leading-none">{best}</span>
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(row.breaks[0].id)}
                              disabled={deleting}
                              aria-label={`מחק ברייק ${best}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {rest.length === 0 ? (
                        <span className="text-muted-foreground">{best !== undefined ? "" : "—"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rest.map((b) => (
                            <span
                              key={b.id}
                              className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-xs font-bold tabular-nums", breakTone(b.value, false))}
                            >
                              {b.value}
                              {onDelete && (
                                <button
                                  type="button"
                                  onClick={() => onDelete(b.id)}
                                  disabled={deleting}
                                  aria-label={`מחק ברייק ${b.value}`}
                                  className="opacity-60 hover:opacity-100 hover:text-destructive"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    {renderAdd && <td className="px-4 py-1.5">{renderAdd(row.participantId)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
