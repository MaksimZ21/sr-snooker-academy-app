"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { SyllabusPanel } from "./syllabus-panel";
import { GuidelinesPanel } from "./guidelines-panel";
import { CoachSelector } from "./coach-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHebrewDate } from "@/lib/date";
import { trainingTypeBadge } from "@/lib/training-type";
import { cn } from "@/lib/utils";

type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
};

export function SessionDetail({
  sessionId,
  canEditAttendance,
  canEditNotes,
  isAdmin = false,
}: {
  sessionId: string;
  canEditAttendance: boolean;
  canEditNotes: boolean;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const [savingEnd, setSavingEnd] = useState(false);
  const endTimeRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
    refetchInterval: 30_000,
  });

  async function saveEndTime(value: string) {
    setSavingEnd(true);
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ end_time: value }),
      });
      if (!r.ok) throw new Error("failed");
      await qc.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("שעת סיום עודכנה");
    } catch {
      toast.error("שגיאה בשמירת שעת הסיום");
    } finally {
      setSavingEnd(false);
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col">
        <div className="bg-brand-gradient px-5 py-5">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-28 bg-white/20" />
              <Skeleton className="h-4 w-16 bg-white/15" />
            </div>
            <Skeleton className="h-6 w-20 bg-white/20" />
          </div>
          <Skeleton className="h-3 w-28 bg-white/15 mt-3" />
        </div>
        <div className="p-4 flex flex-col gap-4">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex flex-col gap-3 mt-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }
  const { session, students, attendance, notesByStudent } = data;
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";

  return (
    <div className="flex flex-col">
      <div className="bg-brand-gradient px-5 pt-5 pb-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-6 left-4 w-28 h-28 rounded-full bg-white/5 blur-xl" />
        </div>
        <div className="flex items-end justify-between gap-3 relative">
          <div>
            <div
              className={cn(
                "text-5xl font-bold tabular-nums tracking-tight text-white leading-none",
                cancelled && "opacity-40 line-through",
              )}
            >
              {session.start_time}
            </div>
            <div className="text-white/60 text-sm mt-1.5 flex items-center gap-1">
              <span>עד</span>
              {isAdmin ? (
                <input
                  ref={endTimeRef}
                  type="text"
                  inputMode="numeric"
                  defaultValue={session.end_time || ""}
                  placeholder="--:--"
                  disabled={savingEnd}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (!val || /^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                      saveEndTime(val);
                    } else {
                      toast.error("פורמט: HH:MM (24 שעות)");
                      e.target.value = session.end_time || "";
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="bg-transparent text-white/60 text-sm outline-none w-12 border-b border-transparent focus:border-white/40 tabular-nums placeholder:text-white/25 transition-colors disabled:opacity-50"
                />
              ) : (
                <span>{session.end_time || "—"}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge className={cn("border text-xs font-medium", className)} variant="outline">
              {label}
            </Badge>
            {cancelled && <Badge variant="destructive">בוטל</Badge>}
          </div>
        </div>
        <p className="text-white/50 text-xs mt-3 relative">{formatHebrewDate(session.date)}</p>
        {isAdmin && (
          <div className="mt-3 relative">
            <CoachSelector sessionId={sessionId} currentCoachEmail={session.coach_email} />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        <Tabs defaultValue="attendance">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="notes">הערות</TabsTrigger>
            <TabsTrigger value="syllabus">סילבוס</TabsTrigger>
            <TabsTrigger value="guidelines">הנחיות</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <AttendancePanel
              sessionId={sessionId}
              students={students}
              attendance={attendance}
              readOnly={!canEditAttendance}
            />
          </TabsContent>
          <TabsContent value="notes">
            <NotesPanel
              sessionId={sessionId}
              students={students}
              notesByStudent={notesByStudent}
              readOnly={!canEditNotes}
            />
          </TabsContent>
          <TabsContent value="syllabus">
            <SyllabusPanel sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="guidelines">
            <GuidelinesPanel trainingType={session.training_type} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
