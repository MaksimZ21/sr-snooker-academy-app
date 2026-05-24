"use client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  const { data, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as Detail;
    },
    refetchInterval: 30_000,
  });

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
            <div className="text-white/60 text-sm mt-1.5">עד {session.end_time}</div>
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
