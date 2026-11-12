"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LeagueLevelRow } from "@/lib/sheets/league-levels";

const MIN_MATCHES = 4;

function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

// Level-change tracking (12 ft): points per player since their last level
// change. Candidates are only flagged; the admin approves each change.
export function LeagueLevelsView({ leagueId, canEdit }: { leagueId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  // Under "league-districts" so entering a match result refreshes it too.
  const queryKey = ["league-districts", leagueId, "levels"];

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/leagues/${leagueId}/levels`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { rows: LeagueLevelRow[] };
    },
  });

  const approveMut = useMutation({
    mutationFn: async (studentId: string) => {
      const r = await fetch(`/api/leagues/${leagueId}/levels`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const body = (await r.json().catch(() => null)) as { level?: string; error?: string } | null;
      if (!r.ok) throw new Error(body?.error ?? "failed");
      return body?.level ?? "";
    },
    onSuccess: (level) => {
      toast.success(`הדרגה עודכנה ל-${level}`);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["league", leagueId] });
    },
    onError: (e) => toast.error(e instanceof Error && e.message !== "failed" ? e.message : "שגיאה בעדכון הדרגה"),
  });

  const rows = data?.rows ?? [];
  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">מעקב פור (12 פיט)</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          ±5 נקודות אחרי {MIN_MATCHES} משחקים לפחות = מועמד לשינוי דרגה. הספירה מתאפסת אחרי כל שינוי.
        </p>
      </div>
      <div className="divide-y divide-border/40">
        {rows.map((r) => (
          <div key={r.studentId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1 min-w-0 truncate">{r.name}</span>
            <span className="w-8 text-center font-semibold">{r.level ?? "—"}</span>
            <span className="w-20 text-xs text-muted-foreground tabular-nums">{r.matches} משחקים</span>
            <span
              className={cn(
                "w-14 text-center tabular-nums font-medium",
                r.points > 0 && "text-emerald-600 dark:text-emerald-400",
                r.points < 0 && "text-destructive",
              )}
              dir="ltr"
            >
              {signed(r.points)}
            </span>
            <div className="w-36 flex justify-end">
              {!r.level ? (
                <span className="text-xs text-destructive">חסר סיווג 12 פיט</span>
              ) : r.status && r.nextLevel ? (
                canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("h-7 text-xs gap-1", r.status === "down" && "text-destructive")}
                    onClick={() => approveMut.mutate(r.studentId)}
                    disabled={approveMut.isPending}
                  >
                    {r.status === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    אשר {r.status === "up" ? "עלייה" : "ירידה"} ל-{r.nextLevel}
                  </Button>
                ) : (
                  <span className="text-xs">מועמד ל{r.status === "up" ? "עלייה" : "ירידה"}</span>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
