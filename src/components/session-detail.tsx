"use client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session, Student, Attendance, Note } from "@/lib/sheets/schemas";
import { AttendancePanel } from "./attendance-panel";
import { NotesPanel } from "./notes-panel";
import { SyllabusPanel } from "./syllabus-panel";
import { GuidelinesPanel } from "./guidelines-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHebrewDate } from "@/lib/date";

type Detail = {
  session: Session;
  students: Student[];
  attendance: Attendance[];
  notesByStudent: Record<string, Note[]>;
};

export function SessionDetail({
  sessionId,
  readOnly,
}: {
  sessionId: string;
  readOnly: boolean;
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
          <Skeleton className="h-7 w-32" />
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

  return (
    <div className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">
          {session.start_time}–{session.end_time}
        </h1>
        <p className="text-muted-foreground">{formatHebrewDate(session.date)}</p>
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
            readOnly={readOnly}
          />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel
            sessionId={sessionId}
            students={students}
            notesByStudent={notesByStudent}
            readOnly={readOnly}
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
