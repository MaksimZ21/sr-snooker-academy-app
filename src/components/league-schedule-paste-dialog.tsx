"use client";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { todayIsoTel, dayLabelHe } from "@/lib/date";
import {
  resolveSchedulePaste,
  shortDate,
  type ScheduleLineResult,
  type ScheduleMatch,
  type ScheduleParticipant,
} from "@/lib/sheets/league-schedule-parse";

type OkLine = Extract<ScheduleLineResult, { ok: true }>;

export function LeagueSchedulePasteDialog({
  open,
  onOpenChange,
  participants,
  matches,
  districtLabels,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ScheduleParticipant[];
  matches: ScheduleMatch[];
  districtLabels: Map<string, string>;
  onSave: (assignments: { matchId: string; date: string }[]) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const results = useMemo(
    () => resolveSchedulePaste(text, participants, matches, todayIsoTel()),
    [text, participants, matches],
  );
  const okLines = results.filter((r): r is OkLine => r.ok);

  async function save() {
    try {
      await onSave(okLines.map((r) => ({ matchId: r.matchId, date: r.date })));
      setText("");
      onOpenChange(false);
    } catch {
      // The mutation's onError already showed a toast; keep the dialog open.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>הדבקת לוז</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"הדבק כאן את הלוז מה-AI, שורה לכל משחק, למשל:\n2.11 | דני כהן - יוסי לוי"}
            className="min-h-36"
          />
          {results.length > 0 && (
            <div className="rounded-xl border border-border/60 divide-y divide-border/40">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
                  {r.ok ? (
                    <Check size={16} className="text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X size={16} className="text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate">{r.raw}</p>
                    <p className={r.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                      {r.ok
                        ? `${districtLabels.get(r.districtId) ?? ""} · ${dayLabelHe(r.date)} ${shortDate(r.date)}${
                            r.movedFrom ? ` · יועבר מ-${shortDate(r.movedFrom)}` : ""
                          }`
                        : r.error}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={save} disabled={okLines.length === 0 || saving}>
            {saving ? "שומר..." : `שבץ ${okLines.length} משחקים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
