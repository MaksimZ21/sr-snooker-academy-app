"use client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { SyllabusPanel } from "./syllabus-panel";
import { GuidelinesPanel } from "./guidelines-panel";
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
}: {
  sessionId: string;
  canEditAttendance: boolean;
  canEditNotes: boolean;
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
      <div className="p-4 flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-48" />
        </header>
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="flex flex-col gap-3 mt-2">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </div>
    );
  }
  const { session, students, attendance, notesByStudent } = data;
  const { label, className } = trainingTypeBadge(session.training_type);
  const cancelled = session.status === "cancelled";

  return (
    <div className="p-4 flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              cancelled && "opacity-50 line-through",
            )}
          >
            {session.start_time}–{session.end_time}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <Badge className={cn("border", className)} variant="outline">
              {label}
            </Badge>
            {cancelled && <Badge variant="destructive">בוטל</Badge>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{formatHebrewDate(session.date)}</p>
      </header>
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
  );
}
