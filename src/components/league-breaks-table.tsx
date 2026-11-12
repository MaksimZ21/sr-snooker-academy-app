import { X } from "lucide-react";
import type { BreakTableRow } from "@/lib/sheets/tournament-logic";

// Shared by the admin and public league pages. No hooks, so it renders on
// the server too; onDelete and renderAdd are only passed on the admin page.
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
  if (visible.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">לא נמצא שחקן בשם הזה</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border/40">
            <th className="text-right px-4 py-1.5 font-medium">מקום</th>
            <th className="text-right px-2 py-1.5 font-medium">שם</th>
            <th className="text-right px-2 py-1.5 font-medium">מחוז</th>
            <th className="text-right px-2 py-1.5 font-medium">ברייקים</th>
            {renderAdd && <th className="text-right px-4 py-1.5 font-medium">הוספה</th>}
          </tr>
        </thead>
        <tbody>
          {visible.map(({ row, place }) => (
            <tr key={row.participantId} className="border-b border-border/20 last:border-b-0">
              <td className="px-4 py-2 text-muted-foreground">{row.breaks.length > 0 ? place : ""}</td>
              <td className="px-2 py-2 whitespace-nowrap">{renderName(row.participantId)}</td>
              <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{districtOf(row.participantId)}</td>
              <td className="px-2 py-2">
                {row.breaks.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {row.breaks.map((b, j) => (
                      <span
                        key={b.id}
                        className={
                          j === 0
                            ? "inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 font-semibold text-primary tabular-nums"
                            : "inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 tabular-nums"
                        }
                      >
                        {b.value}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(b.id)}
                            disabled={deleting}
                            aria-label={`מחק ברייק ${b.value}`}
                            className="text-muted-foreground hover:text-destructive"
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
