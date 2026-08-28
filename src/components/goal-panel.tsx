"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Student } from "@/lib/sheets/schemas";
import { studentFullName } from "@/lib/sheets/schemas";
import { GOAL_CATEGORIES, type MonthlyGoal, type GoalEntry } from "@/lib/sheets/monthly-goals";

export type GoalsByStudent = Record<string, { goal: MonthlyGoal | null; entry: GoalEntry | null }>;

export function GoalPanel({
  sessionId,
  students,
  goalsByStudent,
  readOnly,
}: {
  sessionId: string;
  students: Student[];
  goalsByStudent: GoalsByStudent;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 mt-4">
      {students.map((s) => {
        const info = goalsByStudent[s.id];
        if (!info?.goal) {
          return (
            <div key={s.id} className="flex items-center gap-3 border-2 rounded-xl p-3.5 border-border">
              <div className="font-medium text-sm flex-1">{studentFullName(s)}</div>
              <span className="text-xs text-muted-foreground">לא נבחרה מטרה החודש</span>
            </div>
          );
        }
        return (
          <GoalEntryRow
            key={`${s.id}:${info.entry?.success_count ?? ""}:${info.entry?.attempt_count ?? ""}:${info.entry?.best_break ?? ""}`}
            sessionId={sessionId}
            studentId={s.id}
            studentName={studentFullName(s)}
            goal={info.goal}
            entry={info.entry}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function GoalEntryRow({
  sessionId,
  studentId,
  studentName,
  goal,
  entry,
  readOnly,
}: {
  sessionId: string;
  studentId: string;
  studentName: string;
  goal: MonthlyGoal;
  entry: GoalEntry | null;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const [success, setSuccess] = useState(entry?.success_count?.toString() ?? "");
  const [attempts, setAttempts] = useState(entry?.attempt_count?.toString() ?? "");
  const [bestBreak, setBestBreak] = useState(entry?.best_break?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const label = GOAL_CATEGORIES.find((c) => c.key === goal.category)?.label ?? goal.category;
  const isBreaks = goal.category === "breaks";
  const canSave = isBreaks ? bestBreak !== "" : success !== "" && attempts !== "";

  async function save() {
    setSaving(true);
    try {
      const body = isBreaks
        ? { bestBreak: Number(bestBreak) }
        : { successCount: Number(success), attemptCount: Number(attempts) };
      const r = await fetch(`/api/sessions/${sessionId}/goal-entries/${studentId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("failed");
      await qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("נשמר");
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-2 rounded-xl p-3.5 border-border flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <div className="font-medium text-sm">{studentName}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      {readOnly ? (
        <span className="text-sm">
          {isBreaks
            ? entry?.best_break !== null && entry?.best_break !== undefined
              ? `רצף: ${entry.best_break}`
              : "טרם נרשם"
            : entry?.success_count !== null && entry?.success_count !== undefined
              ? `${entry.success_count} מתוך ${entry.attempt_count}`
              : "טרם נרשם"}
        </span>
      ) : isBreaks ? (
        <>
          <Input
            type="number"
            min={0}
            value={bestBreak}
            onChange={(e) => setBestBreak(e.target.value)}
            placeholder="הרצף הגבוה ביותר"
            className="h-8 w-32 text-sm"
          />
          <Button size="sm" disabled={saving || !canSave} onClick={save} className="h-8 text-xs">
            שמור
          </Button>
        </>
      ) : (
        <>
          <Input
            type="number"
            min={0}
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
            placeholder="הצליחו"
            className="h-8 w-20 text-sm text-center"
          />
          <span className="text-muted-foreground text-xs">מתוך</span>
          <Input
            type="number"
            min={0}
            value={attempts}
            onChange={(e) => setAttempts(e.target.value)}
            placeholder="ניסיונות"
            className="h-8 w-20 text-sm text-center"
          />
          <Button size="sm" disabled={saving || !canSave} onClick={save} className="h-8 text-xs">
            שמור
          </Button>
        </>
      )}
    </div>
  );
}
