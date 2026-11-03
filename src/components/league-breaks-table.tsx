import { X } from "lucide-react";
import type { BreakTableRow } from "@/lib/sheets/tournament-logic";

// Shared by the admin and public league pages. No hooks, so it renders on
// the server too; onDelete is only passed on the admin page.
export function LeagueBreaksTable({
  rows,
  renderName,
  districtOf,
  onDelete,
  deleting,
}: {
  rows: BreakTableRow[];
  renderName: (participantId: string) => React.ReactNode;
  districtOf: (participantId: string) => string;
  onDelete?: (breakId: string) => void;
  deleting?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">עדיין לא נרשמו ברייקים</p>;
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
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.participantId} className="border-b border-border/20 last:border-b-0 align-top">
              <td className="px-4 py-2">{i + 1}</td>
              <td className="px-2 py-2 whitespace-nowrap">{renderName(row.participantId)}</td>
              <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{districtOf(row.participantId)}</td>
              <td className="px-2 py-2">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
